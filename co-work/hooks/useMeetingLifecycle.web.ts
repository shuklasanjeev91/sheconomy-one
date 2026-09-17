import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionState, RoomEvent, type Room } from 'livekit-client'
import { useKeepAwake } from 'expo-keep-awake'

import type { LiveKitMediaMode } from '~/co-work/lib/livekit-media-controls'
import { restoreMeetingMediaAfterForeground } from '~/co-work/lib/livekit-call-media'
import {
  meetingLifecycleNotice,
  type MeetingLifecyclePlatform,
} from '~/co-work/lib/meeting-lifecycle'
import { useMeetingStateManager } from '~/co-work/hooks/useMeetingStateManager'
import { useConnectivity, useOnReconnect } from '~/providers/ConnectivityProvider'

type UseMeetingLifecycleArgs = {
  room: Room
  mediaMode: LiveKitMediaMode
  screenSharing: boolean
  viewingScreenShare: boolean
  cameraEnabled: boolean
  /** Web: unlock/start HTMLAudio after gesture/visibility. */
  onForegroundAudio?: () => void | Promise<void>
}

export function useMeetingLifecycle({
  room,
  mediaMode,
  screenSharing,
  viewingScreenShare,
  cameraEnabled,
  onForegroundAudio,
}: UseMeetingLifecycleArgs) {
  useKeepAwake('sheconomy-meeting-web')
  const { syncLifecycle } = useMeetingStateManager()
  const { isOnline } = useConnectivity()
  const [notice, setNotice] = useState<string | null>(null)
  const [inBackground, setInBackground] = useState(false)
  const [screenShareStoppedByOs, setScreenShareStoppedByOs] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const intendedCameraRef = useRef(cameraEnabled)
  const wasSharingWhenHiddenRef = useRef(false)
  const screenSharingRef = useRef(screenSharing)
  screenSharingRef.current = screenSharing

  useEffect(() => {
    if (!inBackground) {
      intendedCameraRef.current = cameraEnabled
    }
  }, [cameraEnabled, inBackground])

  const platform: MeetingLifecyclePlatform = 'web'

  const refreshNotice = useCallback(
    (overrides?: Partial<{
      inBackground: boolean
      screenShareStoppedByOs: boolean
      restoring: boolean
      reconnecting: boolean
      cameraEnabled: boolean
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
        }),
      )
    },
    [
      cameraEnabled,
      inBackground,
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
    if (typeof document === 'undefined') return

    const onVisibilityChange = () => {
      const hidden = document.visibilityState !== 'visible'
      if (hidden) {
        intendedCameraRef.current = cameraEnabled
        wasSharingWhenHiddenRef.current = screenSharingRef.current
        setInBackground(true)
        setScreenShareStoppedByOs(false)
        setRestoring(false)
        refreshNotice({ inBackground: true, screenShareStoppedByOs: false, restoring: false })
        return
      }

      setInBackground(false)
      setRestoring(true)
      refreshNotice({ inBackground: false, restoring: true })

      void (async () => {
        try {
          await onForegroundAudio?.()
          if (room.state === ConnectionState.Connected) {
            await restoreMeetingMediaAfterForeground(room, mediaMode, {
              intendedCameraOn: intendedCameraRef.current,
            })
            if (wasSharingWhenHiddenRef.current && !screenSharingRef.current) {
              setScreenShareStoppedByOs(true)
              refreshNotice({
                inBackground: false,
                restoring: false,
                screenShareStoppedByOs: true,
              })
              return
            }
          }
        } catch {
          // LiveKit reconnect handles transport; banner stays informative.
        } finally {
          setRestoring(false)
          wasSharingWhenHiddenRef.current = false
          refreshNotice({ inBackground: false, restoring: false })
        }
      })()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    const onPageShow = () => {
      if (document.visibilityState === 'visible') onVisibilityChange()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [cameraEnabled, mediaMode, onForegroundAudio, refreshNotice, room])

  useEffect(() => {
    if (screenSharing) {
      setScreenShareStoppedByOs(false)
      return
    }
    if (inBackground && wasSharingWhenHiddenRef.current) {
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
        await onForegroundAudio?.()
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

  // Keep the centralized machine aligned with active screen share / audio-only mode.
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
    screenShareStoppedByOs,
    cameraPausedByOs: !inBackground && intendedCameraRef.current && !cameraEnabled,
  }
}
