import { Platform } from 'react-native'

import {
  NATIVE_FULLSCREEN_SNAP_POINTS,
  isNativeFullscreenForPlatform,
} from '~/lib/platform/native-fullscreen-core'

export { NATIVE_FULLSCREEN_SNAP_POINTS, isNativeFullscreenForPlatform }

/** True on iOS / Android — overlays should cover the full device screen. */
export const isNativeFullscreenOverlay = isNativeFullscreenForPlatform(Platform.OS)
