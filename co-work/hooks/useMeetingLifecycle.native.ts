import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { MEETING_RECONNECT_BANNER_DEBOUNCE_MS } from '~/co-work/lib/meeting-audio-quality'
import type { MeetingMediaMode } from '~/co-work/lib/meeting-media-controls'
import { applyPreferredCallAudioOutput, configureCallAudio } from '~/co-work/lib/call-audio'
import {
  pauseMeetingCameraForBackground,
  restoreMeetingMediaAfterForeground,
} from '~/co-work/lib/meeting-call-media'
import {
  meetingLifecycleNotice,
  type MeetingLifecyclePlatform,
} from '~/co-work/lib/meeting-lifecycle'
import { classifyMeetingAppStateInterruption, MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS } from '~/co-work/lib/meeting-mobile'
import {
  getMeetingCameraIntent,
  syncMeetingCameraIntentFromTrack,
} from '~/co-work/lib/meeting-camera-intent'
import type { MediasoupConnectionState, MediasoupRoom } from '~/co-work/lib/mediasoup/mediasoup-room'
import { useMeetingStateManager } from '~/co-work/hooks/useMeetingStateManager'
import { isAndroidPipActive, useAndroidPipActive } from '~/lib/session/android-pip'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type UseMeetingLifecycleArgs = {
  room: MediasoupRoom | null
  connection: MediasoupConnectionState
  mediaMode: MeetingMediaMode
  screenSharing: boolean
  viewingScreenShare: boolean
  cameraEnabled: boolean
}

export function useMeetingLifecycle({
  room,
  connection,
  mediaMode,
  screenSharing,
  viewingScreenShare,
  cameraEnabled,
}: UseMeetingLifecycleArgs) {
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const backgroundPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  screenSharingRef.current = screenSharing

  const androidPip = useAndroidPipActive()

  const platform: MeetingLifecyclePlatform = Platform.OS === 'ios' ? 'ios' : 'android'
  const audioOnly = mediaMode === 'audio'

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
        await configureCallAudio(mediaMode)
        await applyPreferredCallAudioOutput(mediaMode)
        if (room?.getSnapshot().connection === 'connected') {
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
            // Android PiP reports `background` but the room is still on screen.
            if (isAndroidPipActive()) return
            confirmBackgroundPause()
          }, MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS)
        }
        return
      }

      clearBackgroundPauseTimer()
      setPhoneCallInterrupted(false)
      if (room?.getSnapshot().connection === 'failed') void room.reconnect()

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
          await configureCallAudio(mediaMode)
          await applyPreferredCallAudioOutput(mediaMode)
          if (room?.getSnapshot().connection === 'connected') {
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

  // PiP window closed while the app stays in the background → normal background pause.
  useEffect(() => {
    if (androidPip || inBackground) return
    const timer = setTimeout(() => {
      if (appStateRef.current === 'background' && !isAndroidPipActive()) confirmBackgroundPause()
    }, MEETING_BACKGROUND_CAMERA_PAUSE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [androidPip, confirmBackgroundPause, inBackground])

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

  useOnReconnect(() => {
    if (room?.getSnapshot().connection === 'failed') void room.reconnect()
    void (async () => {
      try {
        await configureCallAudio(mediaMode)
        await applyPreferredCallAudioOutput(mediaMode)
        if (room?.getSnapshot().connection === 'connected') {
          await restoreMeetingMediaAfterForeground(room, mediaMode, {
            intendedCameraOn: intendedCameraRef.current,
          })
        }
      } catch {
        // Transport recovery is owned by the room; audio routing is best-effort.
      }
    })()
  })

  // Brief blips recover silently — only surface the chip after a sustained reconnect.
  useEffect(() => {
    if (connection !== 'reconnecting') {
      setReconnecting(false)
      return
    }
    const timer = setTimeout(() => setReconnecting(true), MEETING_RECONNECT_BANNER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [connection])

  useEffect(() => {
    if (reconnecting) {
      syncLifecycle({ inMeeting: true, mediaReconnecting: true, screenSharing, audioOnly })
      return
    }
    if (connection !== 'connected') return
    syncLifecycle({ inMeeting: true, mediaReconnecting: false, screenSharing, audioOnly })
  }, [audioOnly, connection, reconnecting, screenSharing, syncLifecycle])

  return {
    notice,
    inBackground,
    phoneCallInterrupted,
    screenShareStoppedByOs,
    cameraPausedByOs: !inBackground && intendedCameraRef.current && !cameraEnabled,
  }
}
