import { resolveAspectRatio, type AspectRatioTuple, type MediaAspectPreset } from '~/lib/media/aspect'
import { requestImageCrop } from '~/lib/media/crop-session'
import {
  captureImage,
  pickImages,
  type PickImagesOptions,
  type PickedImage,
} from '~/lib/media/pick-image'

export type PickAndCropOptions = Omit<PickImagesOptions, 'aspect'> & {
  /** Aspect ratio preset or [w, h]. When set, opens the crop sheet after pick. */
  aspect?: MediaAspectPreset | AspectRatioTuple | null
  /** Force crop UI even without a fixed aspect (free crop). */
  crop?: boolean
  /** Skip the crop UI even when aspect is set. */
  skipCrop?: boolean
  cropTitle?: string
}

/**
 * Pick images and optionally crop each to the requested aspect (web + native).
 */
export async function pickImagesWithCrop(options: PickAndCropOptions = {}): Promise<PickedImage[]> {
  const aspect = resolveAspectRatio(options.aspect)
  const shouldCrop = !options.skipCrop && (!!aspect || options.crop === true)
  const picked = await pickImages({
    multiple: options.multiple,
    maxCount: options.maxCount,
    // Prefer our crop sheet over the OS editor when we will show one.
    allowsEditing: shouldCrop ? false : options.allowsEditing,
    aspect: aspect ?? undefined,
  })
  if (!picked.length) return []
  if (!shouldCrop) return picked

  const cropped: PickedImage[] = []
  for (const image of picked) {
    const result = await requestImageCrop(image, {
      aspect,
      title: options.cropTitle,
    })
    if (result) cropped.push(result)
  }
  return cropped
}

export async function captureImageWithCrop(
  options: {
    aspect?: MediaAspectPreset | AspectRatioTuple | null
    crop?: boolean
    skipCrop?: boolean
    cropTitle?: string
  } = {},
): Promise<PickedImage | null> {
  const shot = await captureImage()
  if (!shot) return null
  const aspect = resolveAspectRatio(options.aspect)
  const shouldCrop = !options.skipCrop && (!!aspect || options.crop === true)
  if (!shouldCrop) return shot
  return requestImageCrop(shot, { aspect, title: options.cropTitle })
}

/** Crop an already-picked image (e.g. drag-and-drop). */
export async function cropIfNeeded(
  image: PickedImage,
  aspect?: MediaAspectPreset | AspectRatioTuple | null,
  options: { skipCrop?: boolean; crop?: boolean; cropTitle?: string } = {},
): Promise<PickedImage | null> {
  const resolved = resolveAspectRatio(aspect)
  const shouldCrop = !options.skipCrop && (!!resolved || options.crop === true)
  if (!shouldCrop) return image
  return requestImageCrop(image, { aspect: resolved, title: options.cropTitle })
}

export async function cropManyIfNeeded(
  images: PickedImage[],
  aspect?: MediaAspectPreset | AspectRatioTuple | null,
  options: { skipCrop?: boolean; crop?: boolean; cropTitle?: string } = {},
): Promise<PickedImage[]> {
  const resolved = resolveAspectRatio(aspect)
  const shouldCrop = !options.skipCrop && (!!resolved || options.crop === true)
  if (!shouldCrop) return images
  const out: PickedImage[] = []
  for (const image of images) {
    const result = await requestImageCrop(image, {
      aspect: resolved,
      title: options.cropTitle,
    })
    if (result) out.push(result)
  }
  return out
}
