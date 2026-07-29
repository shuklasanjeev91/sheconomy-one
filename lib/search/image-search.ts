import { Alert } from 'react-native'

import { describeSearchImage } from '~/lib/ai/client'
import {
  captureImage,
  pickImages,
  readPickedImageBytes,
  releasePickedImage,
  type PickedImage,
} from '~/lib/media/pick-image'
import { isNativeRuntime, isWebRuntime } from '~/lib/platform/capabilities'

const MAX_DATA_URL_BYTES = 3.5 * 1024 * 1024
const TARGET_MAX_EDGE = 1280
const TARGET_JPEG_QUALITY = 0.72

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (typeof btoa === 'function') {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }
  // React Native without btoa — manual base64
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const triplet = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += chars[(triplet >> 18) & 63]
    out += chars[(triplet >> 12) & 63]
    out += b == null ? '=' : chars[(triplet >> 6) & 63]
    out += c == null ? '=' : chars[triplet & 63]
  }
  return out
}

/** Shrink photos on web so edge vision calls stay under size/token limits. */
async function compressImageDataUrlWeb(image: PickedImage): Promise<string | null> {
  if (typeof document === 'undefined') return null
  try {
    const blob = image.file ?? (await (await fetch(image.uri)).blob())
    const bitmap =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(blob)
        : await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('decode_failed'))
            img.src = image.uri
          })

    const width = 'width' in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth
    const height = 'height' in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight
    const scale = Math.min(1, TARGET_MAX_EDGE / Math.max(width, height, 1))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
    const dataUrl = canvas.toDataURL('image/jpeg', TARGET_JPEG_QUALITY)
    return dataUrl.startsWith('data:image/') ? dataUrl : null
  } catch {
    return null
  }
}

export async function pickedImageToDataUrl(image: PickedImage): Promise<string> {
  if (isWebRuntime()) {
    const compressed = await compressImageDataUrlWeb(image)
    if (compressed && compressed.length <= MAX_DATA_URL_BYTES * 1.37) {
      return compressed
    }
  }

  const { buffer, mimeType } = await readPickedImageBytes(image)
  if (buffer.byteLength <= 0) throw new Error('Could not read the selected image.')
  if (buffer.byteLength > MAX_DATA_URL_BYTES) {
    throw new Error('Image is too large. Try a clearer, smaller photo.')
  }
  const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg'
  return `data:${mime};base64,${arrayBufferToBase64(buffer)}`
}

async function promptImageSource(): Promise<'camera' | 'library' | null> {
  if (isWebRuntime()) {
    // Prefer gallery on desktop; captureImage falls back to file input.
    return 'library'
  }

  return new Promise((resolve) => {
    Alert.alert('Search with image', 'Take a photo or choose from your library.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Camera', onPress: () => resolve('camera') },
      { text: 'Library', onPress: () => resolve('library') },
    ])
  })
}

export async function pickSearchImage(): Promise<PickedImage | null> {
  const source = await promptImageSource()
  if (!source) return null

  if (source === 'camera') {
    return captureImage()
  }

  if (isNativeRuntime()) {
    const images = await pickImages({ multiple: false, maxCount: 1 })
    return images[0] ?? null
  }

  // Web: offer camera when available via captureImage path on second thought —
  // library picker is the default for desktop.
  const images = await pickImages({ multiple: false, maxCount: 1 })
  return images[0] ?? null
}

export type ImageSearchDescribeResult = {
  query: string
  category: string | null
  attributes: string[]
}

/**
 * Pick a product photo and turn it into marketplace search keywords via AI.
 */
export async function searchQueryFromImage(): Promise<ImageSearchDescribeResult | null> {
  const picked = await pickSearchImage()
  if (!picked) return null

  try {
    const dataUrl = await pickedImageToDataUrl(picked)
    const result = await describeSearchImage({ dataUrl })
    const query = result.query.trim()
    if (!query) throw new Error('Could not identify the product. Try another photo.')
    return {
      query,
      category: result.category,
      attributes: result.attributes,
    }
  } finally {
    releasePickedImage(picked)
  }
}
