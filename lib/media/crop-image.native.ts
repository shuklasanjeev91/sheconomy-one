import { Image } from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'

import type { PickedImage } from '~/lib/media/pick-image'
import { type CropRect } from '~/lib/media/crop-geometry'

export type { CropRect } from '~/lib/media/crop-geometry'
export { aspectFitCropRect, centeredCropRect } from '~/lib/media/crop-geometry'

export type PreparedCropImage = {
  image: PickedImage
  width: number
  height: number
}

/**
 * Bake the photo upright and return the pixel size the cropper will actually save.
 *
 * Camera files store a landscape buffer plus a rotation flag. The preview follows
 * the flag, but a crop measured from the raw buffer keeps the blank edge and
 * leaves the person as a sliver. Re-encoding here drops the flag so the preview,
 * the measured size, and the saved file are the same pixels.
 */
export async function prepareImageForCrop(image: PickedImage): Promise<PreparedCropImage> {
  const result = await ImageManipulator.manipulateAsync(image.uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  })
  return {
    image: {
      uri: result.uri,
      mimeType: 'image/jpeg',
      fileName: (image.fileName || 'photo.jpg').replace(/\.\w+$/, '') + '-upright.jpg',
    },
    width: result.width,
    height: result.height,
  }
}

export async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error('Could not read image size.')),
    )
  })
}

export async function cropPickedImage(
  image: PickedImage,
  crop: CropRect,
): Promise<PickedImage> {
  const result = await ImageManipulator.manipulateAsync(
    image.uri,
    [
      {
        crop: {
          originX: Math.max(0, Math.round(crop.originX)),
          originY: Math.max(0, Math.round(crop.originY)),
          width: Math.max(1, Math.round(crop.width)),
          height: Math.max(1, Math.round(crop.height)),
        },
      },
    ],
    {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  )

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    fileName: (image.fileName || 'photo.jpg').replace(/\.\w+$/, '') + '-crop.jpg',
  }
}
