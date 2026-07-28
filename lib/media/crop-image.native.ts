import { Image } from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'

import type { PickedImage } from '~/lib/media/pick-image'
import { type CropRect } from '~/lib/media/crop-geometry'

export type { CropRect } from '~/lib/media/crop-geometry'
export { centeredCropRect } from '~/lib/media/crop-geometry'

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
