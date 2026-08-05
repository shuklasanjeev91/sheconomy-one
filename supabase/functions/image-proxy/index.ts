/**
 * Supabase Edge Function: image-proxy
 *
 * Proxies external images that browsers can't load directly
 * (ibb.co page links, Dropbox share links, etc.)
 *
 * Usage:
 *   GET https://<project>.supabase.co/functions/v1/image-proxy?url=<encoded-url>
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Hard timeout on every outbound fetch.
 * Without this, a slow host causes Supabase to kill the function with 502
 * after ~12s. We fail fast with 504 instead.
 */
const FETCH_TIMEOUT_MS = 8_000

/**
 * A realistic browser UA so hosts like imgbb don't block the request.
 * The old "SHEconomyProxy/1.0" UA was likely getting rate-limited.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const PAGE_FETCH_HEADERS = {
  'user-agent': BROWSER_UA,
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.5',
  'cache-control': 'no-cache',
}

const IMAGE_FETCH_HEADERS = {
  'user-agent': BROWSER_UA,
  accept: 'image/webp,image/avif,image/*,*/*;q=0.8',
}

// ─── Allowlists ───────────────────────────────────────────────────────────────

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
  '.supabase.co',
  '.ibb.co',
  '.dropbox.com',
  '.imgur.com',
  '.postimg.cc',
  '.cloudfront.net',
]

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim()
  if (ALLOWED_HOSTS_EXACT.has(h)) return true
  return ALLOWED_HOST_SUFFIXES.some((s) => h.endsWith(s))
}

function isIbb(hostname: string): boolean {
  const h = hostname.toLowerCase()
  // Only share pages (ibb.co / www.ibb.co) need HTML scraping.
  // Direct URLs (i.ibb.co) are fetched straight.
  return h === 'ibb.co' || h === 'www.ibb.co'
}

function isDropbox(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'dropbox.com' || h === 'www.dropbox.com'
}

// ─── HTML og:image extraction ─────────────────────────────────────────────────

/**
 * Extract a direct image URL from a share-page HTML string.
 *
 * imgbb changed their meta-tag attribute ORDER in 2024/2025:
 *   old: <meta property="og:image" content="...">
 *   new: <meta content="..." property="og:image">
 *
 * We try all orderings + twitter:image as a further fallback.
 */
function extractOgImage(html: string): string | null {
  // Standard: property first, then content
  const m1 = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  )
  if (m1?.[1]) return m1[1]

  // imgbb's current format: content first, then property
  const m2 = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  )
  if (m2?.[1]) return m2[1]

  // Twitter card: <meta name="twitter:image" content="...">
  const m3 = html.match(
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  )
  if (m3?.[1]) return m3[1]

  // Twitter card reversed: content first, then name
  const m4 = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  )
  if (m4?.[1]) return m4[1]

  // Legacy rel=image_src <link>
  const l = html.match(
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  )
  return l?.[1] ?? null
}

// ─── Other helpers ────────────────────────────────────────────────────────────

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

function isTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('url')

    if (!source) {
      return Response.json(
        { error: 'Missing url parameter' },
        { status: 400, headers: corsHeaders },
      )
    }

    let parsed: URL
    try {
      parsed = new URL(source)
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400, headers: corsHeaders })
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return Response.json(
        { error: 'Only http/https supported' },
        { status: 400, headers: corsHeaders },
      )
    }

    if (!isAllowedHost(parsed.hostname)) {
      return Response.json(
        { error: 'Image host not supported' },
        { status: 403, headers: corsHeaders },
      )
    }

    let targetUrl = parsed.toString()
    let originalPathMime: string | null = null

    // ── IBB share page → extract og:image direct URL ─────────────────────────
    if (isIbb(parsed.hostname)) {
      let pageRes: Response
      try {
        pageRes = await fetch(targetUrl, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: 'follow',
          headers: PAGE_FETCH_HEADERS,
        })
      } catch (e) {
        return Response.json(
          {
            error: isTimeout(e)
              ? `IBB page did not respond within ${FETCH_TIMEOUT_MS / 1000}s`
              : 'Failed to reach IBB',
            details: (e as Error)?.message,
          },
          { status: 504, headers: corsHeaders },
        )
      }

      if (!pageRes.ok) {
        return Response.json(
          { error: `IBB page returned HTTP ${pageRes.status}` },
          { status: 502, headers: corsHeaders },
        )
      }

      const html = await pageRes.text()
      const ogImage = extractOgImage(html)

      if (!ogImage) {
        return Response.json(
          { error: 'Could not extract direct image URL from IBB page (og:image / twitter:image not found)' },
          { status: 422, headers: corsHeaders },
        )
      }

      let ogParsed: URL
      try {
        ogParsed = new URL(ogImage)
      } catch {
        return Response.json(
          { error: 'Extracted IBB image URL is invalid' },
          { status: 422, headers: corsHeaders },
        )
      }

      if (!isAllowedHost(ogParsed.hostname)) {
        return Response.json(
          { error: 'Resolved host not allowed' },
          { status: 403, headers: corsHeaders },
        )
      }

      targetUrl = ogImage
    }

    // ── Dropbox /scl/fi/ → raw download URL ──────────────────────────────────
    if (isDropbox(parsed.hostname) && parsed.pathname.startsWith('/scl/fi/')) {
      originalPathMime = mimeFromPath(parsed.pathname)
      targetUrl = buildDropboxRawUrl(parsed)
    }

    // ── Fetch the actual image ────────────────────────────────────────────────
    let upstream: Response
    try {
      upstream = await fetch(targetUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
        headers: IMAGE_FETCH_HEADERS,
      })
    } catch (e) {
      return Response.json(
        {
          error: isTimeout(e)
            ? `Image fetch did not respond within ${FETCH_TIMEOUT_MS / 1000}s`
            : 'Failed to fetch image',
          details: (e as Error)?.message,
        },
        { status: 504, headers: corsHeaders },
      )
    }

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: `Upstream returned HTTP ${upstream.status}` },
        { status: 502, headers: corsHeaders },
      )
    }

    const upstreamType = (upstream.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()

    let contentType = upstreamType

    if (!upstreamType.startsWith('image/')) {
      const inferred =
        mimeFromPath(new URL(upstream.url || targetUrl).pathname) ??
        originalPathMime
      if (inferred) {
        contentType = inferred
      } else {
        return Response.json(
          { error: 'URL is not an image' },
          { status: 415, headers: corsHeaders },
        )
      }
    }

    const responseHeaders = new Headers({
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
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
