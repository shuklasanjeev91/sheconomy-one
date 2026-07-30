import * as ImageManipulator from 'expo-image-manipulator'

import type { PickedImage } from '~/lib/media/pick-image'
import { getImageSize } from '~/lib/media/crop-image'
import { POST_CARD_JPEG_QUALITY, POST_CARD_MAX_EDGE } from '~/lib/media/post-card-image'

export { POST_CARD_MAX_EDGE, POST_CARD_JPEG_QUALITY } from '~/lib/media/post-card-image'

function isGif(image: PickedImage): boolean {
  return (
    (image.mimeType || '').toLowerCase().includes('gif') ||
    /\.gif(\?|$)/i.test(image.fileName || image.uri)
  )
}

/** Native: scale down for feed cards, preserve aspect (no crop). */
export async function fitImageForPostCard(image: PickedImage): Promise<PickedImage> {
  if (isGif(image)) return image

  const size = await getImageSize(image.uri)
  const longest = Math.max(size.width, size.height)
  if (longest <= POST_CARD_MAX_EDGE) return image

  const scale = POST_CARD_MAX_EDGE / longest
  const width = Math.max(1, Math.round(size.width * scale))

  const result = await ImageManipulator.manipulateAsync(
    image.uri,
    [{ resize: { width } }],
    {
      compress: POST_CARD_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  )

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    fileName: (image.fileName || 'photo.jpg').replace(/\.\w+$/, '') + '-feed.jpg',
  }
}

export async function fitImagesForPostCard(images: PickedImage[]): Promise<PickedImage[]> {
  const out: PickedImage[] = []
  for (const image of images) {
    out.push(await fitImageForPostCard(image))
  }
  return out
}
