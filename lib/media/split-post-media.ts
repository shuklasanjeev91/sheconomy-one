import type { PickedImage } from '~/lib/media/pick-image'

/** True when a pick is a video (mime, or common extensions when mime is missing). */
export function isPickedVideo(item: PickedImage): boolean {
  const mime = (item.mimeType || '').toLowerCase()
  if (mime.startsWith('video/')) return true
  if (mime.startsWith('image/')) return false
  const name = `${item.fileName || ''} ${item.uri || ''}`.toLowerCase()
  return /\.(mp4|mov|m4v|webm|mkv|avi)(\?|$)/.test(name)
}

/** Split a mixed photo/video pick into photos and videos (both may be non-empty). */
export function splitPostMediaItems(items: PickedImage[]) {
  return {
    photos: items.filter((item) => !isPickedVideo(item)),
    videos: items.filter((item) => isPickedVideo(item)),
  }
}
