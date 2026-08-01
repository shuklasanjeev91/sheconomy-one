/** Normalized post media for feed / profile / detail UI (web + iOS + Android). */

import { parseVideoProvider } from '~/lib/link-preview'

export type PostMediaKind = 'image' | 'video'

export type PostMediaItem = {
  url: string
  kind: PostMediaKind
}

export type PostMediaFields = {
  image_url?: string | null
  image_urls?: string[] | null
  /** Singular legacy alias — some rows store one URL here via metadata. */
  media_url?: string | null
  media_urls?: string[] | null
  video_url?: string | null
  video_urls?: string[] | null
}

export function normalizeUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    .map((url) => url.trim())
}

/** True for direct video files and known watch/embed hosts (YouTube, Vimeo). */
export function isVideoMediaUrl(url: string): boolean {
  if (parseVideoProvider(url)) return true
  const lower = url.toLowerCase().split('?')[0] ?? url.toLowerCase()
  return (
    /\.(mp4|webm|mov|m4v|mkv|ogg|m3u8)$/.test(lower) ||
    lower.includes('/video/') ||
    lower.includes('/embed/') ||
    lower.includes('content-type=video')
  )
}

/** Collect unique media from all posts column variants, preserving order. */
export function collectPostMedia(post: PostMediaFields): PostMediaItem[] {
  const seen = new Set<string>()
  const items: PostMediaItem[] = []

  function add(url: string | null | undefined, forced?: PostMediaKind) {
    const trimmed = typeof url === 'string' ? url.trim() : ''
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    items.push({
      url: trimmed,
      kind: forced ?? (isVideoMediaUrl(trimmed) ? 'video' : 'image'),
    })
  }

  add(post.image_url, 'image')
  for (const url of normalizeUrlList(post.image_urls)) add(url, 'image')
  add(post.media_url)
  for (const url of normalizeUrlList(post.media_urls)) add(url)
  add(post.video_url, 'video')
  for (const url of normalizeUrlList(post.video_urls)) add(url, 'video')

  return items
}

export function postHasMedia(post: PostMediaFields): boolean {
  return collectPostMedia(post).length > 0
}

export function postMediaUrls(post: PostMediaFields): string[] {
  return collectPostMedia(post).map((item) => item.url)
}
