import type { MeetingUiLayout } from '~/co-work/lib/meeting-orientation-layout'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

export type MeetingUiMode = 'normal' | 'maximized'

/** Idle delay before meeting controls auto-hide (Zoom-style 5s). */
export const MEETING_CONTROLS_IDLE_MS = 5_000

export type MeetingUiVisibilityInput = {
  uiMode: MeetingUiMode
  viewMode: MeetingViewMode
  /** Side panel open (chat / people / invite / …). */
  panelOpen: boolean
  waitingCount: number
  busy?: boolean
  /** Host explicitly pinned controls open. */
  controlsPinned?: boolean
  /**
   * More / Share / Settings / Reactions (or any meeting modal) is open.
   * Zoom keeps chrome + sheets up until the user dismisses them.
   */
  modalOpen?: boolean
}

/**
 * Auto-hide is standard Zoom behavior: header and bottom toolbar auto-hide
 * after inactivity and reveal on tap/move.
 * Never auto-hide while a panel/modal is open, someone is in the waiting room,
 * or exit is in progress.
 */
export function shouldAutoHideMeetingControls(input: MeetingUiVisibilityInput): boolean {
  if (input.controlsPinned) return false
  if (input.panelOpen) return false
  if (input.modalOpen) return false
  if (input.waitingCount > 0) return false
  if (input.busy) return false
  return true
}

/** Critical exit actions stay reachable via a peek affordance when controls are hidden. */
export function meetingCriticalControlsAlwaysReachable(): true {
  return true
}

export type MeetingUiPadding = Pick<
  MeetingUiLayout,
  | 'stagePaddingTop'
  | 'stagePaddingBottom'
  | 'headerClearance'
  | 'controlsClearance'
  | 'panelTop'
  | 'panelBottom'
  | 'captionTopOffset'
  | 'captionBottomOffset'
>

/**
 * Maximized mode expands the video/share plane; hidden controls reclaim that inset.
 * Safe-area insets from the base layout are preserved.
 */
export function resolveMeetingUiPadding(input: {
  layout: MeetingUiLayout
  uiMode: MeetingUiMode
  controlsVisible: boolean
  safeTop?: number
  safeBottom?: number
}): MeetingUiPadding {
  const { layout, uiMode, controlsVisible } = input
  const safeTop = Math.max(input.safeTop ?? 0, 0)
  const safeBottom = Math.max(input.safeBottom ?? 0, 0)

  if (uiMode === 'normal' && controlsVisible) {
    return {
      stagePaddingTop: layout.stagePaddingTop,
      stagePaddingBottom: layout.stagePaddingBottom,
      headerClearance: layout.headerClearance,
      controlsClearance: layout.controlsClearance,
      panelTop: layout.panelTop,
      panelBottom: layout.panelBottom,
      captionTopOffset: layout.captionTopOffset,
      captionBottomOffset: layout.captionBottomOffset,
    }
  }

  if (uiMode === 'maximized' && controlsVisible) {
    const headerClearance = Math.max(56, Math.round(layout.headerClearance * 0.72))
    const controlsClearance = Math.max(72, Math.round(layout.controlsClearance * 0.78))
    return {
      stagePaddingTop: Math.max(safeTop, 8) + headerClearance,
      stagePaddingBottom: controlsClearance + Math.max(safeBottom, 4),
      headerClearance,
      controlsClearance,
      panelTop: Math.max(safeTop, 6) + headerClearance - 4,
      panelBottom: controlsClearance + Math.max(safeBottom, 4),
      captionTopOffset: Math.max(safeTop, 6) + headerClearance,
      captionBottomOffset: controlsClearance + 16,
    }
  }

  // Maximized (or immersive share) with minimal overlay — max video area.
  // Leave a thin bottom band for the critical Leave/End peek + captions.
  const peekClearance = 56
  const headerClearance = 12
  return {
    stagePaddingTop: Math.max(safeTop, 4) + headerClearance,
    stagePaddingBottom: peekClearance + Math.max(safeBottom, 4),
    headerClearance,
    controlsClearance: peekClearance,
    panelTop: Math.max(safeTop, 4) + 48,
    panelBottom: peekClearance + Math.max(safeBottom, 4),
    captionTopOffset: Math.max(safeTop, 4) + 20,
    captionBottomOffset: peekClearance + 16,
  }
}

export function applyMeetingUiLayout(
  layout: MeetingUiLayout,
  padding: MeetingUiPadding,
): MeetingUiLayout {
  return {
    ...layout,
    ...padding,
  }
}
