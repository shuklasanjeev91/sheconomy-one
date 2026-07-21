/** Shared zoom steps for images + screen/text magnification (LinkedIn-style). */

export const IMAGE_ZOOM_MIN = 1
export const IMAGE_ZOOM_MAX = 5
/** Each + / − adjusts by this factor (many presses → many levels). */
export const IMAGE_ZOOM_STEP = 1.25

export const SCREEN_ZOOM_MIN = 1
export const SCREEN_ZOOM_MAX = 2
/** Content / text zoom step — every press enlarges every word on screen. */
export const SCREEN_ZOOM_STEP = 0.1

export const SCREEN_ZOOM_STORAGE_KEY = 'sheconomy.screenZoom'

export function clampZoom(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function nextZoomIn(current: number, step: number, max: number) {
  return clampZoom(Math.round((current * step) * 100) / 100, 1, max)
}

export function nextZoomOut(current: number, step: number, min: number) {
  // Upper bound is the current scale — zooming out never increases it.
  return clampZoom(Math.round((current / step) * 100) / 100, min, current)
}

export function formatZoomPercent(scale: number) {
  return `${Math.round(scale * 100)}%`
}
