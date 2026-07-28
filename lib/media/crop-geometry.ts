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
