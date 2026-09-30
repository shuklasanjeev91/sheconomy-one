import { useCallback, useEffect, useRef, useState } from 'react'

import { MEETING_RECONNECT_BANNER_DEBOUNCE_MS } from '~/co-work/lib/meeting-audio-quality'
import type { MeetingMediaMode } from '~/co-work/lib/meeting-media-controls'
import { restoreMeetingMediaAfterForeground } from '~/co-work/lib/meeting-call-media'
import {
  meetingLifecycleNotice,
  type MeetingLifecyclePlatform,
} from '~/co-work/lib/meeting-lifecycle'
import type { MediasoupConnectionState, MediasoupRoom } from '~/co-work/lib/mediasoup/mediasoup-room'
import { useMeetingStateManager } from '~/co-work/hooks/useMeetingStateManager'
import { useOnReconnect } from '~/providers/ConnectivityProvider'

type UseMeetingLifecycleArgs = {
  room: MediasoupRoom | null
  connection: MediasoupConnectionState
  mediaMode: MeetingMediaMode
  screenSharing: boolean
  viewingScreenShare: boolean
  cameraEnabled: boolean
  /** Web: unlock/start HTMLAudio after gesture/visibility. */
  onForegroundAudio?: () => void | Promise<void>
}

export function useMeetingLifecycle({
  room,
  connection,
  mediaMode,
  screenSharing,
  viewingScreenShare,
  cameraEnabled,
  onForegroundAudio,
}: UseMeetingLifecycleArgs) {
  const { syncLifecycle } = useMeetingStateManager()
  const [notice, setNotice] = useState<string | null>(null)
  const [inBackground, setInBackground] = useState(false)
  const [screenShareStoppedByOs, setScreenShareStoppedByOs] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const intendedCameraRef = useRef(cameraEnabled)
  const wasSharingWhenHiddenRef = useRef(false)
  const screenSharingRef = useRef(screenSharing)
  screenSharingRef.current = screenSharing
  const audioOnly = mediaMode === 'audio'

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
        // Zoom-style: keep publishing camera/mic while the tab is hidden.
        // Unpublishing on visibilitychange made video look "paused" after tab
        // switches and after in-app minimize (document can briefly hide).
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
          if (room?.getSnapshot().connection === 'failed') void room.reconnect()
          if (room?.getSnapshot().connection === 'connected') {
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
          // The room owns transport recovery; banner stays informative.
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

  useOnReconnect(() => {
    if (room?.getSnapshot().connection === 'failed') void room.reconnect()
    void (async () => {
      try {
        await onForegroundAudio?.()
        if (room?.getSnapshot().connection === 'connected') {
          await restoreMeetingMediaAfterForeground(room, mediaMode, {
            intendedCameraOn: intendedCameraRef.current,
          })
        }
      } catch {
        // Transport recovery is owned by the room.
      }
    })()
  })

  // Only surface the interrupt chip for sustained SFU recovery — local camera
  // can keep painting while reachability flaps, which made a sticky false banner.
  useEffect(() => {
    if (connection !== 'reconnecting') {
      setReconnecting(false)
      return
    }
    const timer = setTimeout(() => setReconnecting(true), MEETING_RECONNECT_BANNER_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [connection])

  // Keep the centralized machine aligned with active screen share / audio-only mode.
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
    screenShareStoppedByOs,
    cameraPausedByOs: !inBackground && intendedCameraRef.current && !cameraEnabled,
  }
}
