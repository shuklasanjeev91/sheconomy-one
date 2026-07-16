/**
 * Cross-platform video poster derivation (web / iOS / Android).
 * Prefer an explicit poster, then known provider thumbs, then a first-frame tip for direct files.
 */

function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      return u.pathname.split('/').filter(Boolean)[0] || null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const segments = u.pathname.split('/').filter(Boolean)
      return (
        u.searchParams.get('v') ||
        (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live'
          ? segments[1]
          : null) ||
        null
      )
    }
  } catch {
    return null
  }
  return null
}

export function extractYoutubeId(url: string): string | null {
  return youtubeIdFromUrl(url)
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/** Best-effort poster URL for a video source. */
export function getVideoPosterUrl(
  videoUrl: string | null | undefined,
  explicitPoster?: string | null,
): string | null {
  const poster = typeof explicitPoster === 'string' ? explicitPoster.trim() : ''
  if (poster) return poster

  const url = typeof videoUrl === 'string' ? videoUrl.trim() : ''
  if (!url) return null

  const youtubeId = youtubeIdFromUrl(url)
  if (youtubeId) return youtubeThumbnailUrl(youtubeId)

  return null
}

/**
 * Direct file URLs often show a blank/black frame until play.
 * Appending `#t=0.001` tips many web engines to paint the first frame as a thumbnail.
 */
export function videoSrcWithFirstFrame(videoUrl: string): string {
  if (!videoUrl || videoUrl.includes('#')) return videoUrl
  if (!/\.(mp4|webm|mov|m4v|mkv|ogg|m3u8)(\?|$)/i.test(videoUrl.split('#')[0] ?? videoUrl)) {
    return videoUrl
  }
  return `${videoUrl}#t=0.001`
}
