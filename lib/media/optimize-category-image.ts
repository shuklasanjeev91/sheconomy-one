import type { PickedImage } from '~/lib/media/pick-image'
import { getImageSize } from '~/lib/media/crop-image'

/** Longest edge cap for category / subcategory artwork (downscale only). */
export const CATEGORY_IMAGE_MAX_EDGE = 1600
/** JPEG quality when a resize/recompress is needed. */
export const CATEGORY_IMAGE_JPEG_QUALITY = 0.85

function isGif(image: PickedImage): boolean {
  return (
    (image.mimeType || '').toLowerCase().includes('gif') ||
    /\.gif(\?|$)/i.test(image.fileName || image.uri)
  )
}

function revokeBlobUri(uri: string) {
  if (!uri.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(uri)
  } catch {
    // Already revoked.
  }
}

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for optimization.'))
    img.src = uri
  })
}

async function originalByteSize(image: PickedImage): Promise<number> {
  if (image.file?.size) return image.file.size
  try {
    const response = await fetch(image.uri)
    const blob = await response.blob()
    return blob.size
  } catch {
    return 0
  }
}

/**
 * Downscale + lightly compress category artwork for faster loads.
 * Preserves aspect ratio (never crops). Skips GIFs. Keeps the original when
 * the processed file would not be smaller.
 */
export async function optimizeCategoryImage(image: PickedImage): Promise<PickedImage> {
  if (typeof document === 'undefined') return image
  if (isGif(image)) return image

  let width: number
  let height: number
  try {
    const size = await getImageSize(image.uri)
    width = size.width
    height = size.height
  } catch {
    return image
  }

  const longest = Math.max(width, height, 1)
  const needsResize = longest > CATEGORY_IMAGE_MAX_EDGE
  const scale = needsResize ? CATEGORY_IMAGE_MAX_EDGE / longest : 1
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const originalSize = await originalByteSize(image)
  // Small images that already fit — leave untouched.
  if (!needsResize && originalSize > 0 && originalSize <= 400 * 1024) {
    return image
  }

  let img: HTMLImageElement
  try {
    img = await loadHtmlImage(image.uri)
  } catch {
    return image
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return image

  ctx.drawImage(img, 0, 0, targetW, targetH)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', CATEGORY_IMAGE_JPEG_QUALITY),
  )
  if (!blob) return image

  // Never ship a larger file than the admin selected.
  if (originalSize > 0 && blob.size >= originalSize) {
    return image
  }

  const fileName = (image.fileName || 'category.jpg').replace(/\.\w+$/, '') + '.jpg'
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  revokeBlobUri(image.uri)

  return {
    uri: URL.createObjectURL(file),
    mimeType: 'image/jpeg',
    fileName,
    file,
  }
}

export async function optimizeCategoryImages(images: PickedImage[]): Promise<PickedImage[]> {
  const out: PickedImage[] = []
  for (const image of images) {
    out.push(await optimizeCategoryImage(image))
  }
  return out
}
