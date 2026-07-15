import { supabase } from '~/lib/supabase/client'

export type LinkPreview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  /** Direct video file (og:video) or player URL (og:video html / twitter:player). */
  video: string | null
  /** MIME-ish hint for `video` (e.g. "video/mp4", "text/html"). */
  videoType: string | null
}

/** A playable video source resolved from a link preview. */
export type VideoEmbed = {
  src: string
  /** `iframe` for embed players (YouTube/Vimeo), `file` for direct video files. */
  kind: 'iframe' | 'file'
}

type VideoProvider = {
  provider: 'youtube' | 'vimeo'
  id: string
  embed: string
  /** Thumbnail derivable straight from the id (YouTube only). */
  thumbnail: string | null
  siteName: string
}

/** Detect a well-known video provider and derive embed/thumbnail from the URL alone. */
export function parseVideoProvider(url: string): VideoProvider | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const segments = u.pathname.split('/').filter(Boolean)
      const id =
        u.searchParams.get('v') ||
        (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live'
          ? segments[1]
          : '')
      if (id) {
        return {
          provider: 'youtube',
          id,
          embed: `https://www.youtube.com/embed/${id}`,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          siteName: 'YouTube',
        }
      }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id) {
        return {
          provider: 'youtube',
          id,
          embed: `https://www.youtube.com/embed/${id}`,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          siteName: 'YouTube',
        }
      }
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id && /^\d+$/.test(id)) {
        return {
          provider: 'vimeo',
          id,
          embed: `https://player.vimeo.com/video/${id}`,
          thumbnail: null,
          siteName: 'Vimeo',
        }
      }
    }
    if (host === 'player.vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[1]
      return {
        provider: 'vimeo',
        id: id ?? '',
        embed: u.toString(),
        thumbnail: null,
        siteName: 'Vimeo',
      }
    }
  } catch {
    // ignore malformed URLs
  }
  return null
}

/** Resolve a playable video from a preview, preferring known-provider embeds. */
export function getVideoEmbed(preview: LinkPreview): VideoEmbed | null {
  const provider = parseVideoProvider(preview.url)
  if (provider) return { src: provider.embed, kind: 'iframe' }

  if (preview.video) {
    const type = preview.videoType ?? ''
    const looksLikePlayer =
      type.includes('html') || /\/embed\/|player\.|\/e\/|\/v\//i.test(preview.video)
    const looksLikeFile = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(preview.video)
    return { src: preview.video, kind: looksLikeFile && !looksLikePlayer ? 'file' : 'iframe' }
  }
  return null
}

const URL_RE = /(https?:\/\/[^\s]+)/i

/** Return the first http(s) URL in a string, trimming trailing punctuation. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_RE)
  if (!match) return null
  return match[1].replace(/[.,;:!?)\]}'"]+$/, '')
}

const cache = new Map<string, LinkPreview | null>()
const inflight = new Map<string, Promise<LinkPreview | null>>()

/** Fetch Open Graph metadata for a URL via the `link-preview` edge function (cached). */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url) ?? null
  const existing = inflight.get(url)
  if (existing) return existing

  const request = (async (): Promise<LinkPreview | null> => {
    const provider = parseVideoProvider(url)
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } })
      const scraped = error || !data ? null : (data as LinkPreview)

      // Known video providers (YouTube/Vimeo) get a guaranteed preview built from
      // the URL, so they work even when scraping is blocked/JS-gated. Real
      // scraped metadata (title/description) is layered on top when available.
      const preview: LinkPreview | null = provider
        ? {
            url,
            title: scraped?.title ?? null,
            description: scraped?.description ?? null,
            image: scraped?.image ?? provider.thumbnail,
            siteName: scraped?.siteName ?? provider.siteName,
            video: scraped?.video ?? provider.embed,
            videoType: scraped?.videoType ?? 'text/html',
          }
        : scraped

      const meaningful =
        preview && (preview.title || preview.description || preview.image || preview.video)
      const result = meaningful ? preview : null
      cache.set(url, result)
      return result
    } catch {
      const fallback: LinkPreview | null = provider
        ? {
            url,
            title: null,
            description: null,
            image: provider.thumbnail,
            siteName: provider.siteName,
            video: provider.embed,
            videoType: 'text/html',
          }
        : null
      cache.set(url, fallback)
      return fallback
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, request)
  return request
}
