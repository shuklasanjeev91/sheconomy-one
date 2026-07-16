import type { PickedImage } from '~/lib/media/pick-image'

export function splitPostMediaItems(items: PickedImage[]) {
  return {
    photos: items.filter((item) => !item.mimeType?.startsWith('video/')),
    videos: items.filter((item) => item.mimeType?.startsWith('video/')),
  }
}
