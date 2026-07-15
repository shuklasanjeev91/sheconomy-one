import { useCallback, useRef } from 'react'
import { findNodeHandle, NativeModules, Platform, View } from 'react-native'
import Constants from 'expo-constants'
import { useLocalParticipant, useRoomContext } from '@livekit/react-native'
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc'

import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'

type ScreenCapturePickerHandle = React.ElementRef<typeof ScreenCapturePickerView>

/** Shared ref so the picker can live in the meeting room tree while toggles use it. */
const screenCapturePickerRef: { current: ScreenCapturePickerHandle | null } = { current: null }

export function NativeScreenCapturePicker() {
  if (Platform.OS !== 'ios') return null

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      collapsable={false}
    >
      <ScreenCapturePickerView
        ref={(node) => {
          screenCapturePickerRef.current = node
        }}
      />
    </View>
  )
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error ?? '')
}

function isAbortOrCancelError(error: unknown): boolean {
  return /AbortError|NotAllowedError|cancelled|canceled/i.test(errorText(error))
}

function isIosSimulator(): boolean {
  return Platform.OS === 'ios' && Constants.isDevice === false
}

async function showIosBroadcastPicker() {
  const reactTag = findNodeHandle(screenCapturePickerRef.current)
  if (reactTag == null) {
    throw new Error('Screen share picker is not ready. Try again in a moment.')
  }
  const manager = NativeModules.ScreenCapturePickerViewManager
  if (!manager?.show) {
    throw new Error('Screen share is not available in this build. Rebuild the iOS app.')
  }
  await manager.show(reactTag)
}

export function useLiveKitMediaControls(): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()

  const screenSharingRef = useRef(isScreenShareEnabled)
  screenSharingRef.current = isScreenShareEnabled

  const toggleScreenShare = useCallback(async () => {
    const enabling = !screenSharingRef.current

    if (enabling && Platform.OS === 'ios') {
      if (isIosSimulator()) {
        throw new Error('Screen sharing requires a physical iPhone or iPad.')
      }
      await showIosBroadcastPicker()
    }

    try {
      await localParticipant.setScreenShareEnabled(enabling)
    } catch (error) {
      if (isAbortOrCancelError(error)) {
        if (Platform.OS === 'ios') {
          if (isIosSimulator()) {
            throw new Error('Screen sharing requires a physical iPhone or iPad.')
          }
          throw new Error(
            enabling
              ? 'Screen share was cancelled. Choose Start Broadcast in the system sheet to present.'
              : 'Could not stop screen share.',
          )
        }
        throw new Error(
          enabling
            ? 'Screen share permission was denied. Allow screen capture when prompted.'
            : 'Could not stop screen share.',
        )
      }
      throw error
    }
  }, [localParticipant])

  return {
    room,
    localParticipant,
    audioEnabled: isMicrophoneEnabled,
    videoEnabled: isCameraEnabled,
    screenSharing: isScreenShareEnabled,
    toggleAudio: () => {
      const next = !isMicrophoneEnabled
      void localParticipant.setMicrophoneEnabled(next, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
    },
    toggleVideo: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
    toggleScreenShare,
  }
}
