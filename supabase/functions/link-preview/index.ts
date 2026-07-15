import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FETCH_TIMEOUT_MS = 6000
const MAX_BYTES = 512 * 1024

type Preview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  video: string | null
  videoType: string | null
}

/** Block requests to loopback / link-local / private networks to reduce SSRF risk. */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return true
  // IPv4 private / link-local / loopback ranges.
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  return false
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeEntities(match[1].trim())
  }
  return null
}

function extractPreview(html: string, baseUrl: string): Preview {
  const title =
    metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    ]) ?? metaContent(html, [/<title[^>]*>([^<]+)<\/title>/i])

  const description = metaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ])

  let image = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ])
  if (image) {
    try {
      image = new URL(image, baseUrl).toString()
    } catch {
      image = null
    }
  }

  const siteName =
    metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    ]) ?? new URL(baseUrl).hostname.replace(/^www\./, '')

  let video = metaContent(html, [
    /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:secure_url["']/i,
    /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:url["']/i,
    /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i,
    /<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:player["']/i,
  ])
  if (video) {
    try {
      video = new URL(video, baseUrl).toString()
    } catch {
      video = null
    }
  }

  const videoType = metaContent(html, [
    /<meta[^>]+property=["']og:video:type["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:type["']/i,
  ])

  return { url: baseUrl, title, description, image, siteName, video, videoType }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const empty = (url: string): Preview => ({
    url,
    title: null,
    description: null,
    image: null,
    siteName: null,
    video: null,
    videoType: null,
  })

  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string }
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || isBlockedHost(parsed.hostname)) {
      return new Response(JSON.stringify(empty(url)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let html = ''
    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SheconomyBot/1.0; +link-preview)',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.includes('text/html') || !response.body) {
        clearTimeout(timeout)
        return new Response(JSON.stringify(empty(parsed.toString())), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Read only the first chunk(s) up to MAX_BYTES (metadata lives in <head>).
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let received = 0
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        html += decoder.decode(value, { stream: true })
        if (/<\/head>/i.test(html)) break
      }
      try {
        await reader.cancel()
      } catch {
        // ignore
      }
    } finally {
      clearTimeout(timeout)
    }

    const preview = extractPreview(html, parsed.toString())
    return new Response(JSON.stringify(preview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('link-preview error:', error)
    return new Response(JSON.stringify({ error: 'Failed to build preview' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
