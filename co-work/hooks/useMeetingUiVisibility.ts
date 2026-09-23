import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import {
  MEETING_CONTROLS_IDLE_MS,
  shouldAutoHideMeetingControls,
  type MeetingUiVisibilityInput,
} from '~/co-work/lib/meeting-ui-overlay'

type UseMeetingUiVisibilityOptions = MeetingUiVisibilityInput & {
  controlsVisible: boolean
  onSetControlsVisible: (visible: boolean) => void
}

/**
 * Auto-hides immersive meeting controls after idle, and reveals them on move/tap.
 * Critical actions stay available via a separate peek in the room screen.
 */
export function useMeetingUiVisibility({
  controlsVisible,
  onSetControlsVisible,
  ...visibility
}: UseMeetingUiVisibilityOptions) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibilityRef = useRef(visibility)
  visibilityRef.current = visibility

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearIdle()
    if (!shouldAutoHideMeetingControls(visibilityRef.current)) return
    idleTimerRef.current = setTimeout(() => {
      if (!shouldAutoHideMeetingControls(visibilityRef.current)) return
      onSetControlsVisible(false)
    }, MEETING_CONTROLS_IDLE_MS)
  }, [clearIdle, onSetControlsVisible])

  const revealControls = useCallback(() => {
    if (!controlsVisible) onSetControlsVisible(true)
    scheduleHide()
  }, [controlsVisible, onSetControlsVisible, scheduleHide])

  // Force-show when auto-hide is not allowed (panels, waiting room, busy, pinned).
  useEffect(() => {
    if (!shouldAutoHideMeetingControls(visibility)) {
      clearIdle()
      if (!controlsVisible) onSetControlsVisible(true)
      return clearIdle
    }
    scheduleHide()
    return clearIdle
  }, [
    clearIdle,
    controlsVisible,
    onSetControlsVisible,
    scheduleHide,
    visibility.busy,
    visibility.controlsPinned,
    visibility.modalOpen,
    visibility.panelOpen,
    visibility.uiMode,
    visibility.viewMode,
    visibility.waitingCount,
  ])

  // Web: mouse movement anywhere in the meeting reveals controls.
  // Use refs so the listener identity stays stable (avoids re-bind storms).
  const revealRef = useRef(revealControls)
  revealRef.current = revealControls

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    if (!shouldAutoHideMeetingControls(visibilityRef.current)) return

    const onMove = () => revealRef.current()
    const onKey = () => revealRef.current()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [
    visibility.busy,
    visibility.controlsPinned,
    visibility.modalOpen,
    visibility.panelOpen,
    visibility.uiMode,
    visibility.viewMode,
    visibility.waitingCount,
  ])

  const toggleControls = useCallback(() => {
    if (!shouldAutoHideMeetingControls(visibilityRef.current)) {
      if (!controlsVisible) onSetControlsVisible(true)
      return
    }
    if (controlsVisible) {
      clearIdle()
      onSetControlsVisible(false)
    } else {
      onSetControlsVisible(true)
      scheduleHide()
    }
  }, [clearIdle, controlsVisible, onSetControlsVisible, scheduleHide])

  return {
    revealControls,
    toggleControls,
    scheduleHide,
  }
}
