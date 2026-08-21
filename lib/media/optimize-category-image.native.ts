import * as ImageManipulator from 'expo-image-manipulator'

import type { PickedImage } from '~/lib/media/pick-image'
import { getImageSize } from '~/lib/media/crop-image'

/** Keep in sync with optimize-category-image.ts */
export const CATEGORY_IMAGE_MAX_EDGE = 1600
export const CATEGORY_IMAGE_JPEG_QUALITY = 0.85

function isGif(image: PickedImage): boolean {
  return (
    (image.mimeType || '').toLowerCase().includes('gif') ||
    /\.gif(\?|$)/i.test(image.fileName || image.uri)
  )
}

/** Native: downscale category artwork, preserve aspect (no crop). */
export async function optimizeCategoryImage(image: PickedImage): Promise<PickedImage> {
  if (isGif(image)) return image

  const size = await getImageSize(image.uri)
  const longest = Math.max(size.width, size.height, 1)
  if (longest <= CATEGORY_IMAGE_MAX_EDGE) return image

  const scale = CATEGORY_IMAGE_MAX_EDGE / longest
  const width = Math.max(1, Math.round(size.width * scale))

  const result = await ImageManipulator.manipulateAsync(
    image.uri,
    [{ resize: { width } }],
    {
      compress: CATEGORY_IMAGE_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  )

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    fileName: (image.fileName || 'category.jpg').replace(/\.\w+$/, '') + '.jpg',
  }
}

export async function optimizeCategoryImages(images: PickedImage[]): Promise<PickedImage[]> {
  const out: PickedImage[] = []
  for (const image of images) {
    out.push(await optimizeCategoryImage(image))
  }
  return out
}
