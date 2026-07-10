import type { PickImagesOptions, PickedImage } from '~/lib/media/pick-image'

export type { PickedImage, PickImagesOptions }

export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  try {
    const ImagePicker = await import('expo-image-picker')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      throw new Error('Photo library permission is required to upload images.')
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: !!options.multiple,
      selectionLimit: options.maxCount ?? (options.multiple ? 5 : 1),
      quality: 0.85,
    })

    if (result.canceled) return []

    return result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? undefined,
    }))
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Cannot find module')
        ? 'Image picker is not available. Run: yarn add expo-image-picker'
        : error instanceof Error
          ? error.message
          : 'Could not open photo library.'
    throw new Error(message)
  }
}

export async function pickedImageToBlob(image: PickedImage): Promise<Blob> {
  const response = await fetch(image.uri)
  if (!response.ok) {
    throw new Error('Could not read the selected image.')
  }
  return response.blob()
}

export function releasePickedImage(_image: PickedImage) {}
