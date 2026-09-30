import type { ElementRef } from 'react'
import { findNodeHandle, NativeModules, Platform, View } from 'react-native'
import { ScreenCapturePickerView } from 'react-native-webrtc'

import { ScreenShareCancelledError } from '~/co-work/lib/meeting-screen-share'
import CallAudio from '~/modules/call-audio'

type ScreenCapturePickerHandle = ElementRef<typeof ScreenCapturePickerView>

/** Long enough to read the sheet; the picker closing without a start resolves sooner. */
const BROADCAST_START_TIMEOUT_MS = 60_000

/** Shared ref so the picker can live in the meeting room tree while toggles use it. */
const screenCapturePickerRef: { current: ScreenCapturePickerHandle | null } = { current: null }

/** Hidden ReplayKit picker; `showIosBroadcastPicker` opens the system sheet. */
export function NativeScreenCapturePicker() {
  if (Platform.OS !== 'ios') return null

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      collapsable={false}
    >
      <ScreenCapturePickerView
        ref={(node: ScreenCapturePickerHandle | null) => {
          screenCapturePickerRef.current = node
        }}
      />
    </View>
  )
}

/**
 * Opens the system broadcast sheet and resolves once Start Broadcast begins.
 * Throws `ScreenShareCancelledError` when the user closes the sheet instead.
 */
export async function showIosBroadcastPicker() {
  const reactTag = findNodeHandle(screenCapturePickerRef.current as never)
  if (reactTag == null) {
    throw new Error('Screen share picker is not ready. Try again in a moment.')
  }
  const manager = NativeModules.ScreenCapturePickerViewManager
  if (!manager?.show) {
    throw new Error('Screen share is not available in this build. Rebuild the iOS app.')
  }
  // Listen before the sheet opens so a fast start is never missed. Older binaries
  // without the listener fall back to sharing straight away.
  const started = CallAudio?.waitForScreenBroadcast?.(BROADCAST_START_TIMEOUT_MS) ?? Promise.resolve(true)
  await manager.show(reactTag)
  if (!(await started)) throw new ScreenShareCancelledError()
}
