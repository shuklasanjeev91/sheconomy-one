import type {
  PickedDocument,
  PickImagesOptions,
  PickMediaOptions,
  PickVideosOptions,
  PickedImage,
  PickedMedia,
  PickedVideo,
} from '~/lib/media/pick-image'

export type {
  PickedDocument,
  PickedImage,
  PickedMedia,
  PickedVideo,
  PickImagesOptions,
  PickMediaOptions,
  PickVideosOptions,
}

export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  try {
    const ImagePicker = await import('expo-image-picker')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      throw new Error('Photo library permission is required to upload images.')
    }

    const aspect = options.aspect
    const allowsEditing =
      options.allowsEditing ?? (!!aspect && !options.multiple)

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: !!options.multiple && !allowsEditing,
      selectionLimit: options.maxCount ?? (options.multiple ? 5 : 1),
      quality: 0.85,
      exif: false,
      allowsEditing,
      aspect: aspect ? [aspect[0], aspect[1]] : undefined,
      // Prefer JPEG/PNG over HEIC so uploaded avatars render everywhere.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })

    if (result.canceled) return []

    return result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: normalizeImageMime(asset.mimeType, asset.uri, asset.fileName),
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

export async function pickMedia(options: PickMediaOptions = {}): Promise<PickedMedia[]> {
  const accept = options.accept ?? 'image'
  if (accept === 'image') return pickImages(options)
  if (accept === 'video') return pickVideos(options)

  if (accept === 'any') {
    try {
      const DocumentPicker = await import('expo-document-picker')
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: !!options.multiple,
      })

      if (result.canceled) return []

      const maxCount = options.maxCount ?? (options.multiple ? 10 : 1)
      return (result.assets ?? []).slice(0, maxCount).map((asset) => ({
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        fileName: asset.name ?? 'file',
        fileSize: asset.size ?? undefined,
      }))
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('Cannot find module')
          ? 'Document picker is not available. Run: yarn add expo-document-picker'
          : error instanceof Error
            ? error.message
            : 'Could not open files.'
      throw new Error(message)
    }
  }

  try {
    const ImagePicker = await import('expo-image-picker')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      throw new Error('Photo library permission is required to upload media.')
    }

    const maxCount = options.maxCount ?? (options.multiple ? 5 : 1)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: !!options.multiple,
      selectionLimit: maxCount,
      videoMaxDuration: 180,
      quality: 0.85,
    })

    if (result.canceled) return []

    return result.assets.map((asset) => {
      const isVideo =
        asset.mimeType?.startsWith('video/') ||
        ('type' in asset && asset.type === 'video')
      return {
        uri: asset.uri,
        mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        fileName: asset.fileName ?? undefined,
      }
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Cannot find module')
        ? 'Media picker is not available. Run: yarn add expo-image-picker'
        : error instanceof Error
          ? error.message
          : 'Could not open media library.'
    throw new Error(message)
  }
}

export async function pickVideos(options: PickVideosOptions = {}): Promise<PickedVideo[]> {
  try {
    const ImagePicker = await import('expo-image-picker')
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      throw new Error('Photo library permission is required to upload videos.')
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: !!options.multiple,
      selectionLimit: options.maxCount ?? (options.multiple ? 3 : 1),
      videoMaxDuration: 180,
      quality: 1,
    })

    if (result.canceled) return []

    return result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'video/mp4',
      fileName: asset.fileName ?? undefined,
    }))
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Cannot find module')
        ? 'Video picker is not available. Run: yarn add expo-image-picker'
        : error instanceof Error
          ? error.message
          : 'Could not open video library.'
    throw new Error(message)
  }
}

export async function captureImage(): Promise<PickedImage | null> {
  try {
    const ImagePicker = await import('expo-image-picker')
    const permission = await ImagePicker.requestCameraPermissionsAsync()

    if (!permission.granted) {
      throw new Error('Camera permission is required to take a photo.')
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })

    if (result.canceled) return null

    const asset = result.assets[0]
    if (!asset) return null

    return {
      uri: asset.uri,
      mimeType: normalizeImageMime(asset.mimeType, asset.uri, asset.fileName),
      fileName: asset.fileName ?? undefined,
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Cannot find module')
        ? 'Camera is not available. Run: yarn add expo-image-picker'
        : error instanceof Error
          ? error.message
          : 'Could not open the camera.'
    throw new Error(message)
  }
}

export async function pickDocument(): Promise<PickedDocument | null> {
  try {
    const DocumentPicker = await import('expo-document-picker')
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled) return null

    const asset = result.assets?.[0]
    if (!asset) return null

    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      fileName: asset.name ?? 'file',
      fileSize: asset.size ?? undefined,
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Cannot find module')
        ? 'Document picker is not available. Run: yarn add expo-document-picker'
        : error instanceof Error
          ? error.message
          : 'Could not open documents.'
    throw new Error(message)
  }
}

function normalizeImageMime(
  mimeType?: string | null,
  uri?: string,
  fileName?: string | null,
): string {
  const raw = (mimeType || '').toLowerCase()
  if (raw.startsWith('image/') && !raw.includes('heic') && !raw.includes('heif')) {
    return raw
  }
  const name = `${fileName || ''} ${uri || ''}`.toLowerCase()
  if (name.includes('.png')) return 'image/png'
  if (name.includes('.webp')) return 'image/webp'
  if (name.includes('.gif')) return 'image/gif'
  // HEIC and unknown image types: label as JPEG (picker quality re-encodes).
  return 'image/jpeg'
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // eslint-disable-next-line no-undef -- RN / Hermes provide atob
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export type PickedImageBytes = {
  buffer: ArrayBuffer
  mimeType: string
  fileName?: string
  byteLength: number
}

/**
 * Read picker bytes once. Prefer FileSystem on native — `fetch(fileUri).blob()`
 * is unreliable and RN Blobs can only be read once (empty second upload).
 */
export async function readPickedImageBytes(image: PickedImage): Promise<PickedImageBytes> {
  const mimeType = normalizeImageMime(image.mimeType, image.uri, image.fileName)

  try {
    const FileSystem = await import('expo-file-system/legacy')
    const base64 = await FileSystem.readAsStringAsync(image.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    if (base64) {
      const buffer = base64ToArrayBuffer(base64)
      if (buffer.byteLength > 0) {
        return {
          buffer,
          mimeType,
          fileName: image.fileName,
          byteLength: buffer.byteLength,
        }
      }
    }
  } catch {
    // Fall through to fetch for unusual URI schemes.
  }

  const response = await fetch(image.uri)
  if (!response.ok) {
    throw new Error('Could not read the selected image.')
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength <= 0) {
    throw new Error('Could not read the selected image.')
  }
  return {
    buffer,
    mimeType,
    fileName: image.fileName,
    byteLength: buffer.byteLength,
  }
}

export async function pickedImageToBlob(image: PickedImage): Promise<Blob> {
  const bytes = await readPickedImageBytes(image)
  return new Blob([new Uint8Array(bytes.buffer)], { type: bytes.mimeType })
}

export function releasePickedImage(_image: PickedImage) {}
