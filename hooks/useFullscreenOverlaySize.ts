import { useMemo } from 'react'
import { Dimensions, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
 *
 * Android draws edge-to-edge but its window height excludes the status and
 * navigation bars, so a sheet sized to it stops short and the tab bar shows
 * through underneath. Add the bar insets back, capped at the physical screen.
 */
export function useFullscreenOverlaySize(): FullscreenOverlaySize {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const overlayHeight =
    Platform.OS === 'android'
      ? Math.min(Dimensions.get('screen').height, height + insets.top + insets.bottom)
      : height

  return useMemo(() => ({ width, height: overlayHeight }), [width, overlayHeight])
}
