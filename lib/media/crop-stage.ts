export type CropTransform = {
  /** Translation in stage pixels, relative to the centered image. */
  x: number
  y: number
  scale: number
}

export type CropStageHandle = {
  getTransform: () => CropTransform
  /** Clamped to the current frame/image bounds before it is applied. */
  setTransform: (next: CropTransform) => void
}

export type CropStageProps = {
  uri: string
  /** Cover-fitted image size in stage pixels (scale 1). */
  imageWidth: number
  imageHeight: number
  /** Crop window size in stage pixels. */
  frameWidth: number
  frameHeight: number
  minZoom: number
  maxZoom: number
  onTransformChange?: (next: CropTransform) => void
}

export function clampCropTransform(
  next: CropTransform,
  bounds: {
    imageWidth: number
    imageHeight: number
    frameWidth: number
    frameHeight: number
    minZoom: number
    maxZoom: number
  },
): CropTransform {
  const scale = Math.min(bounds.maxZoom, Math.max(bounds.minZoom, next.scale))
  const maxX = Math.max(0, (bounds.imageWidth * scale - bounds.frameWidth) / 2)
  const maxY = Math.max(0, (bounds.imageHeight * scale - bounds.frameHeight) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, next.x)),
    y: Math.min(maxY, Math.max(-maxY, next.y)),
    scale,
  }
}
