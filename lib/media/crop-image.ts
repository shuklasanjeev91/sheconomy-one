import type { PickedImage } from '~/lib/media/pick-image'
import { type CropRect } from '~/lib/media/crop-geometry'

export type { CropRect } from '~/lib/media/crop-geometry'
export { centeredCropRect } from '~/lib/media/crop-geometry'

/** Web: crop via canvas. Native: use crop-image.native.ts. */
export async function cropPickedImage(
  image: PickedImage,
  crop: CropRect,
): Promise<PickedImage> {
  if (typeof document === 'undefined') {
    throw new Error('Image crop is only available in the browser on this build.')
  }

  const img = await loadHtmlImage(image.uri)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width))
  canvas.height = Math.max(1, Math.round(crop.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not crop this image.')

  ctx.drawImage(
    img,
    crop.originX,
    crop.originY,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
  )
  if (!blob) throw new Error('Could not crop this image.')

  const fileName = (image.fileName || 'photo.jpg').replace(/\.\w+$/, '') + '-crop.jpg'
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

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for cropping.'))
    img.src = uri
  })
}

export async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  if (typeof document !== 'undefined') {
    const img = await loadHtmlImage(uri)
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }
  }
  throw new Error('getImageSize requires a platform implementation on native.')
}
