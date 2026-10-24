import type { ListingImageDraft } from '~/lib/listing/listing.type'
import { isWebRuntime } from '~/lib/platform/capabilities'

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

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : ''
        if (result.startsWith('data:image/')) resolve(result)
        else reject(new Error('Could not read image data.'))
      }
      reader.onerror = () => reject(new Error('Could not read image data.'))
      reader.readAsDataURL(blob)
    })
  }
  const buffer = await blob.arrayBuffer()
  const mime = blob.type?.startsWith('image/') ? blob.type : 'image/jpeg'
  return `data:${mime};base64,${arrayBufferToBase64(buffer)}`
}

async function compressBlobWeb(blob: Blob): Promise<string | null> {
  if (typeof document === 'undefined') return null
  try {
    const bitmap =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(blob)
        : await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error('decode_failed'))
            img.src = URL.createObjectURL(blob)
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

/** Convert a listing image draft (local blob or remote URL) into a vision-safe data URL. */
export async function listingImageDraftToDataUrl(image: ListingImageDraft): Promise<string> {
  if (image.image_url?.startsWith('data:image/')) {
    return image.image_url
  }

  let blob: Blob | null = image.blob ?? null
  if (!blob && image.image_url) {
    // A saved listing photo often lives on a shop CDN. The browser cannot read
    // those bytes, so SHERPA fetches the public URL itself.
    if (image.image_url.startsWith('https://')) {
      try {
        const response = await fetch(image.image_url)
        if (response.ok) blob = await response.blob()
      } catch {
        return image.image_url
      }
      if (!blob) return image.image_url
    } else {
      const response = await fetch(image.image_url)
      if (!response.ok) throw new Error('Could not load listing photo.')
      blob = await response.blob()
    }
  }
  if (!blob) throw new Error('Add a photo before drafting with AI.')

  if (isWebRuntime()) {
    const compressed = await compressBlobWeb(blob)
    if (compressed && compressed.length <= MAX_DATA_URL_BYTES * 1.37) {
      return compressed
    }
  }

  if (blob.size > MAX_DATA_URL_BYTES) {
    throw new Error('Image is too large. Try a clearer, smaller photo.')
  }

  return blobToDataUrl(blob)
}
