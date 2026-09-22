import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { ConnectionState, RoomEvent, type Room } from 'livekit-client'
import { useKeepAwake } from 'expo-keep-awake'

import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'
import {
  applyPreferredCallAudioOutput,
  configureLiveKitCallAudio,
} from '~/co-work/lib/livekit-call-audio'
import {
  pauseMeetingCameraForBackground,
  restoreMeetingMediaAfterForeground,
} from '~/co-work/lib/livekit-call-media'
import {
  meetingLifecycleNotice,
  type MeetingLifecyclePlatform,
} from '~/co-work/lib/meeting-lifecycle'
import { classifyMeetingAppStateInterruption, MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS } from '~/co-work/lib/meeting-mobile'
import {
  getMeetingCameraIntent,
  syncMeetingCameraIntentFromTrack,
} from '~/co-work/lib/meeting-camera-intent'
import { useMeetingStateManager } from '~/co-work/hooks/useMeetingStateManager'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type UseMeetingLifecycleArgs = {
  room: Room
  mediaMode: LiveKitMediaMode
  screenSharing: boolean
  viewingScreenShare: boolean
  cameraEnabled: boolean
  speakerOn: boolean
}

export function useMeetingLifecycle({
  room,
  mediaMode,
  screenSharing,
  viewingScreenShare,
  cameraEnabled,
  speakerOn,
}: UseMeetingLifecycleArgs) {
  useKeepAwake('sheconomy-meeting-native')
  const { syncLifecycle } = useMeetingStateManager()
  const [notice, setNotice] = useState<string | null>(null)
  // Initial state: only true OS background counts. Permission sheets often
  // leave currentState as 'inactive' briefly — never start with the banner on.
  const [inBackground, setInBackground] = useState(AppState.currentState === 'background')
  const [phoneCallInterrupted, setPhoneCallInterrupted] = useState(false)
  const [screenShareStoppedByOs, setScreenShareStoppedByOs] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const intendedCameraRef = useRef(cameraEnabled)
  const wasSharingWhenBackgroundRef = useRef(false)
  const screenSharingRef = useRef(screenSharing)
  const speakerOnRef = useRef(speakerOn)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const backgroundPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  screenSharingRef.current = screenSharing
  speakerOnRef.current = speakerOn

  const platform: MeetingLifecyclePlatform = Platform.OS === 'ios' ? 'ios' : 'android'

  useEffect(() => {
    if (!inBackground) {
      // Prefer explicit Start Video intent over the last published track state.
      intendedCameraRef.current = getMeetingCameraIntent() || cameraEnabled
      syncMeetingCameraIntentFromTrack(intendedCameraRef.current)
    }
  }, [cameraEnabled, inBackground])

  const clearBackgroundPauseTimer = useCallback(() => {
    if (backgroundPauseTimerRef.current) {
      clearTimeout(backgroundPauseTimerRef.current)
      backgroundPauseTimerRef.current = null
    }
  }, [])

  const refreshNotice = useCallback(
    (overrides?: Partial<{
      inBackground: boolean
      screenShareStoppedByOs: boolean
      restoring: boolean
      reconnecting: boolean
      cameraEnabled: boolean
      phoneCallInterrupted: boolean
    }>) => {
      setNotice(
        meetingLifecycleNotice({
          platform,
          inBackground: overrides?.inBackground ?? inBackground,
          isSharingScreen: screenSharingRef.current,
          isViewingSharedScreen: viewingScreenShare,
          intendedCameraOn: intendedCameraRef.current,
          cameraEnabled: overrides?.cameraEnabled ?? cameraEnabled,
          screenShareStoppedByOs: overrides?.screenShareStoppedByOs ?? screenShareStoppedByOs,
          restoring: overrides?.restoring ?? restoring,
          reconnecting: overrides?.reconnecting ?? reconnecting,
          phoneCallInterrupted: overrides?.phoneCallInterrupted ?? phoneCallInterrupted,
        }),
      )
    },
    [
      cameraEnabled,
      inBackground,
      phoneCallInterrupted,
      platform,
      reconnecting,
      restoring,
      screenShareStoppedByOs,
      viewingScreenShare,
    ],
  )

  const confirmBackgroundPause = useCallback(() => {
    // Keep prior intent — do not overwrite with cameraEnabled mid permission sheet.
    intendedCameraRef.current = getMeetingCameraIntent() || intendedCameraRef.current
    wasSharingWhenBackgroundRef.current = screenSharingRef.current
    setInBackground(true)
    setScreenShareStoppedByOs(false)
    setRestoring(false)
    refreshNotice({
      inBackground: true,
      screenShareStoppedByOs: false,
      restoring: false,
    })
    void (async () => {
      try {
        await configureLiveKitCallAudio(mediaMode)
        await applyPreferredCallAudioOutput(mediaMode, speakerOnRef.current)
        if (room.state === ConnectionState.Connected) {
          await pauseMeetingCameraForBackground(room)
        }
      } catch {
        // Soft-fail — stay connected; banner explains limits.
      }
    })()
  }, [mediaMode, refreshNotice, room])

  useEffect(() => {
    refreshNotice()
  }, [refreshNotice])

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const previous = appStateRef.current
      appStateRef.current = next

      const interruption = classifyMeetingAppStateInterruption({ previous, next })
      if (interruption === 'phone_call') {
        setPhoneCallInterrupted(true)
        refreshNotice({ phoneCallInterrupted: true })
      }

      if (next !== 'active') {
        // `inactive` (control center, permission sheets, More modal) must NOT
        // pause the camera. Android permission dialogs often flip to
        // `background` briefly — debounce before treating as a true pause.
        if (next === 'background') {
          clearBackgroundPauseTimer()
          backgroundPauseTimerRef.current = setTimeout(() => {
            backgroundPauseTimerRef.current = null
            if (appStateRef.current !== 'background') return
            confirmBackgroundPause()
          }, MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS)
        }
        return
      }

      clearBackgroundPauseTimer()
      setPhoneCallInterrupted(false)

      // Brief permission-sheet background never confirmed — no restore banner.
      if (!inBackground) {
        refreshNotice({ inBackground: false, restoring: false, phoneCallInterrupted: false })
        return
      }

      setInBackground(false)
      setRestoring(true)
      refreshNotice({ inBackground: false, restoring: true, phoneCallInterrupted: false })

      void (async () => {
        try {
          await configureLiveKitCallAudio(mediaMode)
          await applyPreferredCallAudioOutput(mediaMode, speakerOnRef.current)
          if (room.state === ConnectionState.Connected) {
            await restoreMeetingMediaAfterForeground(room, mediaMode, {
              intendedCameraOn: getMeetingCameraIntent() || intendedCameraRef.current,
            })
            if (wasSharingWhenBackgroundRef.current && !screenSharingRef.current) {
              setScreenShareStoppedByOs(true)
              refreshNotice({
                inBackground: false,
                restoring: false,
                screenShareStoppedByOs: true,
                phoneCallInterrupted: false,
              })
              return
            }
          }
        } catch {
          // Never crash on audio restore failure after a phone call / OS interruption.
        } finally {
          setRestoring(false)
          wasSharingWhenBackgroundRef.current = false
          refreshNotice({ inBackground: false, restoring: false, phoneCallInterrupted: false })
        }
      })()
    }

    const subscription = AppState.addEventListener('change', onChange)
    return () => {
      subscription.remove()
      clearBackgroundPauseTimer()
    }
  }, [
    clearBackgroundPauseTimer,
    confirmBackgroundPause,
    inBackground,
    mediaMode,
    refreshNotice,
    room,
  ])

  useEffect(() => {
    if (screenSharing) {
      setScreenShareStoppedByOs(false)
      return
    }
    if (inBackground && wasSharingWhenBackgroundRef.current) {
      setScreenShareStoppedByOs(true)
      refreshNotice({ screenShareStoppedByOs: true, inBackground: true })
    }
  }, [inBackground, refreshNotice, screenSharing])

  useEffect(() => {
    if (!screenShareStoppedByOs) return
    const timer = setTimeout(() => setScreenShareStoppedByOs(false), 8_000)
    return () => clearTimeout(timer)
  }, [screenShareStoppedByOs])

  useEffect(() => {
    if (
      room.state === ConnectionState.Reconnecting ||
      room.state === ConnectionState.SignalReconnecting
    ) {
      return
    }
    if (room.state === ConnectionState.Connected && reconnecting) {
      setReconnecting(false)
      syncLifecycle({
        inMeeting: true,
        mediaReconnecting: false,
        screenSharing,
        audioOnly: mediaMode === 'audio',
      })
      refreshNotice({ reconnecting: false })
    }
  }, [mediaMode, reconnecting, refreshNotice, room.state, screenSharing, syncLifecycle])

  useOnReconnect(() => {
    if (
      room.state === ConnectionState.Connected ||
      room.state === ConnectionState.Connecting
    ) {
      setReconnecting(false)
      refreshNotice({ reconnecting: false })
    } else if (
      room.state === ConnectionState.Reconnecting ||
      room.state === ConnectionState.SignalReconnecting
    ) {
      setReconnecting(true)
      refreshNotice({ reconnecting: true })
    }
    void (async () => {
      try {
        await configureLiveKitCallAudio(mediaMode)
        await applyPreferredCallAudioOutput(mediaMode, speakerOnRef.current)
        if (room.state === ConnectionState.Connected) {
          await restoreMeetingMediaAfterForeground(room, mediaMode, {
            intendedCameraOn: intendedCameraRef.current,
          })
          syncLifecycle({
            inMeeting: true,
            mediaReconnecting: false,
            screenSharing: screenSharingRef.current,
            audioOnly: mediaMode === 'audio',
          })
        }
      } catch {
        syncLifecycle({
          inMeeting: true,
          mediaReconnecting: true,
          screenSharing: screenSharingRef.current,
          audioOnly: mediaMode === 'audio',
        })
      } finally {
        if (room.state === ConnectionState.Connected || room.state === ConnectionState.Connecting) {
          setReconnecting(false)
          refreshNotice({ reconnecting: false })
        }
      }
    })()
  })

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const onConnection = (state: ConnectionState) => {
      if (
        state === ConnectionState.Reconnecting ||
        state === ConnectionState.SignalReconnecting
      ) {
        if (debounceTimer) return
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          if (
            room.state !== ConnectionState.Reconnecting &&
            room.state !== ConnectionState.SignalReconnecting
          ) {
            return
          }
          setReconnecting(true)
          syncLifecycle({
            inMeeting: true,
            mediaReconnecting: true,
            screenSharing: screenSharingRef.current,
            audioOnly: mediaMode === 'audio',
          })
          refreshNotice({ reconnecting: true })
        }, 1_500)
        return
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      setReconnecting(false)
      if (state === ConnectionState.Connected || state === ConnectionState.Connecting) {
        syncLifecycle({
          inMeeting: true,
          mediaReconnecting: false,
          screenSharing: screenSharingRef.current,
          audioOnly: mediaMode === 'audio',
        })
      }
      refreshNotice({ reconnecting: false })
    }
    room.on(RoomEvent.ConnectionStateChanged, onConnection)
    if (
      room.state === ConnectionState.Connected ||
      room.state === ConnectionState.Connecting ||
      room.state === ConnectionState.Disconnected
    ) {
      setReconnecting(false)
      refreshNotice({ reconnecting: false })
    }
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onConnection)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [mediaMode, refreshNotice, room, syncLifecycle])

  useEffect(() => {
    if (reconnecting) return
    if (room.state !== ConnectionState.Connected) return
    syncLifecycle({
      inMeeting: true,
      mediaReconnecting: false,
      screenSharing,
      audioOnly: mediaMode === 'audio',
    })
  }, [mediaMode, reconnecting, room.state, screenSharing, syncLifecycle])

  return {
    notice,
    inBackground,
    phoneCallInterrupted,
    screenShareStoppedByOs,
    cameraPausedByOs: !inBackground && intendedCameraRef.current && !cameraEnabled,
  }
}
