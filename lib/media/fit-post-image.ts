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

/**
 * Scale an image down to fit inside a POST_CARD_MAX_EDGE box while preserving
 * aspect ratio (LinkedIn/Facebook — no crop). Skips GIFs and images that already fit.
 */
export async function fitImageForPostCard(image: PickedImage): Promise<PickedImage> {
  if (typeof document === 'undefined') return image
  if (isGif(image)) return image

  const size = await getImageSize(image.uri)
  const longest = Math.max(size.width, size.height)
  if (longest <= POST_CARD_MAX_EDGE) return image

  const scale = POST_CARD_MAX_EDGE / longest
  const width = Math.max(1, Math.round(size.width * scale))
  const height = Math.max(1, Math.round(size.height * scale))

  const img = await loadHtmlImage(image.uri)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return image

  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', POST_CARD_JPEG_QUALITY),
  )
  if (!blob) return image

  const fileName = (image.fileName || 'photo.jpg').replace(/\.\w+$/, '') + '-feed.jpg'
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  if (image.uri.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(image.uri)
    } catch {
      // ignore
    }
  }

  return {
    uri: URL.createObjectURL(file),
    mimeType: 'image/jpeg',
    fileName,
    file,
  }
}

export async function fitImagesForPostCard(images: PickedImage[]): Promise<PickedImage[]> {
  const out: PickedImage[] = []
  for (const image of images) {
    out.push(await fitImageForPostCard(image))
  }
  return out
}

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for feed resize.'))
    img.src = uri
  })
}
