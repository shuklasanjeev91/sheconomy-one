import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { ConnectionState, RoomEvent, type Room } from 'livekit-client'
import { useKeepAwake } from 'expo-keep-awake'

import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'
import {
  applyPreferredCallAudioOutput,
  configureLiveKitCallAudio,
} from '~/co-work/lib/livekit-call-audio'
import { restoreMeetingMediaAfterForeground } from '~/co-work/lib/livekit-call-media'
import {
  meetingLifecycleNotice,
  type MeetingLifecyclePlatform,
} from '~/co-work/lib/meeting-lifecycle'
import { classifyMeetingAppStateInterruption } from '~/co-work/lib/meeting-mobile'
import { useMeetingStateManager } from '~/co-work/hooks/useMeetingStateManager'
import { useConnectivity, useOnReconnect } from '~/providers/ConnectivityProvider'

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
  const { isOnline } = useConnectivity()
  const [notice, setNotice] = useState<string | null>(null)
  const [inBackground, setInBackground] = useState(AppState.currentState !== 'active')
  const [phoneCallInterrupted, setPhoneCallInterrupted] = useState(false)
  const [screenShareStoppedByOs, setScreenShareStoppedByOs] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const intendedCameraRef = useRef(cameraEnabled)
  const wasSharingWhenBackgroundRef = useRef(false)
  const screenSharingRef = useRef(screenSharing)
  const speakerOnRef = useRef(speakerOn)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  screenSharingRef.current = screenSharing
  speakerOnRef.current = speakerOn

  const platform: MeetingLifecyclePlatform = Platform.OS === 'ios' ? 'ios' : 'android'

  useEffect(() => {
    if (!inBackground) {
      intendedCameraRef.current = cameraEnabled
    }
  }, [cameraEnabled, inBackground])

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
        if (next === 'background') {
          intendedCameraRef.current = cameraEnabled
          wasSharingWhenBackgroundRef.current = screenSharingRef.current
          setInBackground(true)
          setScreenShareStoppedByOs(false)
          setRestoring(false)
          refreshNotice({
            inBackground: true,
            screenShareStoppedByOs: false,
            restoring: false,
          })
        }
        return
      }

      setPhoneCallInterrupted(false)
      setInBackground(false)
      setRestoring(true)
      refreshNotice({ inBackground: false, restoring: true, phoneCallInterrupted: false })

      void (async () => {
        try {
          await configureLiveKitCallAudio(mediaMode)
          await applyPreferredCallAudioOutput(mediaMode, speakerOnRef.current)
          if (room.state === ConnectionState.Connected) {
            await restoreMeetingMediaAfterForeground(room, mediaMode, {
              intendedCameraOn: intendedCameraRef.current,
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
    return () => subscription.remove()
  }, [cameraEnabled, mediaMode, refreshNotice, room])

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
    if (!isOnline) {
      setReconnecting(true)
      syncLifecycle({
        inMeeting: true,
        mediaReconnecting: true,
        screenSharing,
        audioOnly: mediaMode === 'audio',
      })
      refreshNotice({ reconnecting: true })
    }
  }, [isOnline, mediaMode, refreshNotice, screenSharing, syncLifecycle])

  useOnReconnect(() => {
    setReconnecting(true)
    refreshNotice({ reconnecting: true })
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
        setReconnecting(false)
        refreshNotice({ reconnecting: false })
      }
    })()
  })

  useEffect(() => {
    const onConnection = (state: ConnectionState) => {
      if (
        state === ConnectionState.Reconnecting ||
        state === ConnectionState.SignalReconnecting
      ) {
        setReconnecting(true)
        syncLifecycle({
          inMeeting: true,
          mediaReconnecting: true,
          screenSharing: screenSharingRef.current,
          audioOnly: mediaMode === 'audio',
        })
        refreshNotice({ reconnecting: true })
        return
      }
      if (state === ConnectionState.Connected) {
        setReconnecting(false)
        syncLifecycle({
          inMeeting: true,
          mediaReconnecting: false,
          screenSharing: screenSharingRef.current,
          audioOnly: mediaMode === 'audio',
        })
        refreshNotice({ reconnecting: false })
      }
    }
    room.on(RoomEvent.ConnectionStateChanged, onConnection)
    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onConnection)
    }
  }, [mediaMode, refreshNotice, room, syncLifecycle])

  useEffect(() => {
    if (reconnecting || !isOnline) return
    if (room.state !== ConnectionState.Connected) return
    syncLifecycle({
      inMeeting: true,
      mediaReconnecting: false,
      screenSharing,
      audioOnly: mediaMode === 'audio',
    })
  }, [isOnline, mediaMode, reconnecting, room.state, screenSharing, syncLifecycle])

  return {
    notice,
    inBackground,
    phoneCallInterrupted,
    screenShareStoppedByOs,
    cameraPausedByOs: !inBackground && intendedCameraRef.current && !cameraEnabled,
  }
}
