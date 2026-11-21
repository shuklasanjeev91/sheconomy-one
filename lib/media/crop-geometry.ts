import type { AspectRatioTuple } from '~/lib/media/aspect'

export type CropRect = {
  /** Origin X in source image pixels */
  originX: number
  originY: number
  width: number
  height: number
}

/**
 * Compute a centered crop rectangle that matches `aspect` inside the source size.
 * Used when the user confirms without fine-tuning, and as the default crop frame.
 */
export function centeredCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspect: AspectRatioTuple,
): CropRect {
  const [aw, ah] = aspect
  const target = aw / ah
  const source = sourceWidth / Math.max(sourceHeight, 1)

  if (source > target) {
    const width = Math.round(sourceHeight * target)
    const originX = Math.round((sourceWidth - width) / 2)
    return { originX, originY: 0, width, height: sourceHeight }
  }

  const height = Math.round(sourceWidth / target)
  const originY = Math.round((sourceHeight - height) / 2)
  return { originX: 0, originY, width: sourceWidth, height }
}

/**
 * Shrink `rect` onto `aspect` around its own center.
 * Keeps a pan the user already made. A centered fallback would jump back to
 * the middle of the photo and save the blank background instead.
 */
export function aspectFitCropRect(
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
  aspect: AspectRatioTuple,
): CropRect {
  const target = aspect[0] / aspect[1]
  let { originX, originY, width, height } = rect
  const current = width / Math.max(height, 1)

  if (current > target) {
    const nextWidth = Math.max(1, Math.round(height * target))
    originX += Math.round((width - nextWidth) / 2)
    width = nextWidth
  } else if (current < target) {
    const nextHeight = Math.max(1, Math.round(width / target))
    originY += Math.round((height - nextHeight) / 2)
    height = nextHeight
  }

  originX = Math.max(0, Math.min(originX, Math.max(0, sourceWidth - 1)))
  originY = Math.max(0, Math.min(originY, Math.max(0, sourceHeight - 1)))
  width = Math.max(1, Math.min(width, sourceWidth - originX))
  height = Math.max(1, Math.min(height, sourceHeight - originY))
  return { originX, originY, width, height }
}
