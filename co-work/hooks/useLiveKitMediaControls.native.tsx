// Keep first: LiveKit's WebRTC layer extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findNodeHandle, NativeModules, Platform, View } from 'react-native'
import Constants from 'expo-constants'
import { useLocalParticipant, useRoomContext } from '@livekit/react-native'
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc'

import {
  resolveCallAudioCapture,
  configureLiveKitCallAudio,
  getActiveCallMediaMode,
  toggleCallSpeaker,
  type CallAudioRoute,
} from '~/co-work/lib/livekit-call-audio'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'
import { softMediaToggleFailure } from '~/co-work/lib/meeting-mobile'
import { ensureNativeMicrophonePermission } from '~/co-work/lib/meeting-media-permissions'
import { setMeetingCameraIntent } from '~/co-work/lib/meeting-camera-intent'
import { setLocalScreenShareEnabled } from '~/co-work/lib/livekit-screen-share'
import { flipLocalParticipantCamera } from '~/co-work/lib/livekit-flip-camera'
import { androidPresentUnavailable, ANDROID_PRESENT_UNAVAILABLE_MESSAGE } from '~/co-work/lib/android-present-build'
import { useMeetingVideoEffects } from '~/co-work/hooks/useMeetingVideoEffects.native'
import { useMeetingAudioQuality } from '~/co-work/hooks/useMeetingAudioQuality.native'

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

function routeIsSpeaker(route: CallAudioRoute): boolean {
  return route === 'speaker'
}

export function useLiveKitMediaControls(preferSpeaker = true): LiveKitMediaControls {
  const room = useRoomContext()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant()
  const [speakerOn, setSpeakerOn] = useState(preferSpeaker)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const cameraFacingRef = useRef<'user' | 'environment'>('user')
  const videoEffects = useMeetingVideoEffects()
  const audioQuality = useMeetingAudioQuality(
    room,
    localParticipant,
    isMicrophoneEnabled,
    speakerOn,
  )
  const muteInFlightRef = useRef(false)
  const flipInFlightRef = useRef(false)

  useEffect(() => {
    setSpeakerOn(preferSpeaker)
  }, [preferSpeaker])

  const screenSharingRef = useRef(isScreenShareEnabled)
  screenSharingRef.current = isScreenShareEnabled

  const toggleScreenShare = useCallback(async (options?: import('~/co-work/lib/livekit-screen-share').ScreenShareStartOptions | null) => {
    const enabling = !screenSharingRef.current

    try {
      if (enabling && androidPresentUnavailable()) {
        throw new Error(ANDROID_PRESENT_UNAVAILABLE_MESSAGE)
      }
      if (enabling && Platform.OS === 'ios') {
        if (isIosSimulator()) {
          throw new Error('Screen sharing requires a physical iPhone or iPad.')
        }
        // Show ReplayKit picker first; getDisplayMedia then waits for Start Broadcast.
        await showIosBroadcastPicker()
      }

      // iOS connects to ScreenShareExtension through the app-group socket.
      // Android opens the MediaProjection consent sheet and keeps capture alive
      // through the configured foreground screen-share service.
      await setLocalScreenShareEnabled(
        localParticipant,
        enabling,
        'native',
        enabling ? options : null,
      )
    } catch (error) {
      if (isAbortOrCancelError(error)) {
        if (Platform.OS === 'ios') {
          if (isIosSimulator()) {
            throw new Error('Screen sharing requires a physical iPhone or iPad.')
          }
          throw new Error(
            enabling
              ? isAbortOrCancelError(error)
                ? 'Screen share was cancelled. Choose SHEconomy → Start Broadcast in the system sheet.'
                : softMediaToggleFailure('screen_share', error)
              : 'Could not stop screen share.',
          )
        }
        throw new Error(
          enabling
            ? softMediaToggleFailure('screen_share', error)
            : 'Could not stop screen share.',
        )
      }
      throw new Error(softMediaToggleFailure('screen_share', error))
    }
  }, [localParticipant])

  const toggleSpeaker = useCallback(async () => {
    try {
      const next = !speakerOn
      const route = await toggleCallSpeaker(next)
      // Reflect the actual selected route so Bluetooth/earpiece don't look like speaker.
      setSpeakerOn(routeIsSpeaker(route))
    } catch (cause) {
      audioQuality.reportError(softMediaToggleFailure('speaker', cause))
    }
  }, [audioQuality, speakerOn])

  const toggleAudio = useCallback(() => {
    if (muteInFlightRef.current) return
    const next = !isMicrophoneEnabled
    muteInFlightRef.current = true
    audioQuality.clearError()
    void (async () => {
      try {
        if (next) {
          const permission = await ensureNativeMicrophonePermission()
          if (!permission.granted) {
            audioQuality.reportError(
              permission.message ??
                softMediaToggleFailure('microphone', undefined, {
                  blockedInSettings: permission.blockedInSettings,
                }),
            )
            return
          }
          // Re-assert the call audio session before first publish after a muted join.
          await configureLiveKitCallAudio(getActiveCallMediaMode()).catch(() => {})
        }
        try {
          const capture = await resolveCallAudioCapture()
          await localParticipant.setMicrophoneEnabled(next, capture)
        } catch (advanced) {
          if (!next) throw advanced
          // Fallback without capture constraints — some Android devices reject AEC/NS opts.
          await localParticipant.setMicrophoneEnabled(true)
        }
      } catch (cause) {
        audioQuality.reportError(softMediaToggleFailure('microphone', cause))
      } finally {
        muteInFlightRef.current = false
      }
    })()
  }, [audioQuality, isMicrophoneEnabled, localParticipant])

  const toggleVideo = useCallback(() => {
    const next = !isCameraEnabled
    setMeetingCameraIntent(next)
    audioQuality.clearError()
    void localParticipant
      .setCameraEnabled(next, next ? { facingMode: cameraFacingRef.current } : undefined)
      .catch((cause) => {
        // Revert intent if the OS denied camera so lifecycle doesn't keep restoring.
        setMeetingCameraIntent(isCameraEnabled)
        audioQuality.reportError(softMediaToggleFailure('camera', cause))
      })
  }, [audioQuality, isCameraEnabled, localParticipant])

  const flipCamera = useCallback(async () => {
    if (flipInFlightRef.current) return cameraFacingRef.current
    flipInFlightRef.current = true
    audioQuality.clearError()
    try {
      if (!isCameraEnabled) {
        setMeetingCameraIntent(true)
      }
      const nextFacing = await flipLocalParticipantCamera(
        localParticipant,
        cameraFacingRef.current,
      )
      cameraFacingRef.current = nextFacing
      setCameraFacing(nextFacing)
      setMeetingCameraIntent(true)
      return nextFacing
    } catch (cause) {
      audioQuality.reportError(softMediaToggleFailure('camera', cause))
      throw cause instanceof Error ? cause : new Error(String(cause))
    } finally {
      flipInFlightRef.current = false
    }
  }, [audioQuality, isCameraEnabled, localParticipant])

  return useMemo(
    () => ({
      room,
      localParticipant,
      audioEnabled: isMicrophoneEnabled,
      videoEnabled: isCameraEnabled,
      screenSharing: isScreenShareEnabled,
      videoEffects,
      audioQuality,
      speakerOn,
      cameraFacing,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
      flipCamera,
    }),
    [
      room,
      localParticipant,
      isMicrophoneEnabled,
      isCameraEnabled,
      isScreenShareEnabled,
      videoEffects,
      audioQuality,
      speakerOn,
      cameraFacing,
      toggleAudio,
      toggleVideo,
      toggleScreenShare,
      toggleSpeaker,
      flipCamera,
    ],
  )
}
