import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'

export type FullscreenOverlaySize = { width: number; height: number }

/**
 * Live device screen size for overlays that cover the whole screen — bottom
 * sheets, the Select/Popover sheet, and the photo editor.
 *
 * Percentage sizing is not enough for these: a sheet is portaled out of the
 * route tree, so `100%` resolves against whatever host the portal lands in
 * rather than the device. Measuring gives every sheet the same exact frame on
 * web, iOS, and Android, and it re-measures on rotation, split screen, and
 * browser resize because `useWindowDimensions` is reactive.
 */
export function useFullscreenOverlaySize(): FullscreenOverlaySize {
  const { width, height } = useWindowDimensions()

  return useMemo(() => ({ width, height }), [width, height])
}
