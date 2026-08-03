/**
 * Supabase Edge Function: image-proxy
 *
 * Proxies external images that browsers can't load directly
 * (ibb.co page links, Dropbox share links, etc.)
 *
 * Usage:
 *   GET https://<project>.supabase.co/functions/v1/image-proxy?url=<encoded-url>
 *
 * This is the Deno/Edge port of the old Next.js /api/image-proxy route.
 * Logic is identical — only the runtime changed.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROXY_REQUIRED_HOSTS = new Set([
  'ibb.co',
  'www.ibb.co',
  'dropbox.com',
  'www.dropbox.com',
])

const ALLOWED_HOSTS_EXACT = new Set([
  'ibb.co', 'www.ibb.co', 'i.ibb.co',
  'www.dropbox.com', 'dropbox.com',
  'storage.googleapis.com',
  's3.amazonaws.com',
  'res.cloudinary.com',
  'imgur.com', 'www.imgur.com', 'i.imgur.com',
  'postimg.cc', 'www.postimg.cc', 'i.postimg.cc',
  'imageshack.com', 'www.imageshack.com',
  'live.staticflickr.com',
  'images.unsplash.com', 'plus.unsplash.com',
  'images.pexels.com',
  'cdn.pixabay.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
])

const ALLOWED_HOST_SUFFIXES = [
  '.dropboxusercontent.com',
  '.s3.amazonaws.com',
  '.storage.googleapis.com',
  '.supabaseusercontent.com',
  '.backblazeb2.com',
  '.r2.dev',
  '.cloudflareimages.com',
  '.imageshack.com',
  '.staticflickr.com',
]

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim()
  if (ALLOWED_HOSTS_EXACT.has(h)) return true
  return ALLOWED_HOST_SUFFIXES.some((s) => h.endsWith(s))
}

function isIbb(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'ibb.co' || h === 'www.ibb.co'
}

function isDropbox(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'dropbox.com' || h === 'www.dropbox.com'
}

function extractOgImage(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (m?.[1]) return m[1]
  const l = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)
  return l?.[1] ?? null
}

function buildDropboxRawUrl(u: URL): string {
  const c = new URL(u.toString())
  c.searchParams.set('raw', '1')
  c.searchParams.set('dl', '1')
  return c.toString()
}

function mimeFromPath(pathname: string): string | null {
  const ext = pathname.toLowerCase().split('?')[0].split('.').pop()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif',
    bmp: 'image/bmp', svg: 'image/svg+xml',
  }
  return ext ? (map[ext] ?? null) : null
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (request) => {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('url')

    if (!source) {
      return Response.json({ error: 'Missing url parameter' }, { status: 400, headers: corsHeaders })
    }

    let parsed: URL
    try {
      parsed = new URL(source)
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400, headers: corsHeaders })
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return Response.json({ error: 'Only http/https supported' }, { status: 400, headers: corsHeaders })
    }

    if (!isAllowedHost(parsed.hostname)) {
      return Response.json(
        { error: 'Image host not supported' },
        { status: 403, headers: corsHeaders },
      )
    }

    let targetUrl = parsed.toString()
    let originalPathMime: string | null = null

    // ── IBB: fetch page → extract og:image ──
    if (isIbb(parsed.hostname)) {
      const pageRes = await fetch(targetUrl, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; SHEconomyProxy/1.0)' },
      })
      if (!pageRes.ok) {
        return Response.json({ error: 'Failed to load IBB page' }, { status: 502, headers: corsHeaders })
      }
      const html = await pageRes.text()
      const ogImage = extractOgImage(html)
      if (!ogImage) {
        return Response.json({ error: 'Could not extract image from IBB' }, { status: 422, headers: corsHeaders })
      }
      const ogParsed = new URL(ogImage)
      if (!isAllowedHost(ogParsed.hostname)) {
        return Response.json({ error: 'Resolved host not allowed' }, { status: 403, headers: corsHeaders })
      }
      targetUrl = ogImage
    }

    // ── Dropbox /scl/fi/ → raw download URL ──
    if (isDropbox(parsed.hostname) && parsed.pathname.startsWith('/scl/fi/')) {
      originalPathMime = mimeFromPath(parsed.pathname)
      targetUrl = buildDropboxRawUrl(parsed)
    }

    // ── Fetch the actual image ──
    const upstream = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SHEconomyProxy/1.0)' },
    })

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'Failed to fetch image' }, { status: 502, headers: corsHeaders })
    }

    const upstreamType = (upstream.headers.get('content-type') ?? '')
      .split(';')[0].trim().toLowerCase()

    let contentType = upstreamType

    if (!upstreamType.startsWith('image/')) {
      // Try to infer from resolved URL or original Dropbox path
      const inferred =
        mimeFromPath(new URL(upstream.url || targetUrl).pathname) ??
        originalPathMime
      if (inferred) {
        contentType = inferred
      } else {
        return Response.json({ error: 'URL is not an image' }, { status: 415, headers: corsHeaders })
      }
    }

    const responseHeaders = new Headers({
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24h — images don't change
    })

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    return new Response(upstream.body, { status: 200, headers: responseHeaders })

  } catch (err) {
    return Response.json(
      { error: 'Proxy error', details: (err as Error)?.message },
      { status: 500, headers: corsHeaders },
    )
  }
})