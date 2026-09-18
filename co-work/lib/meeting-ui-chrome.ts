import type { MeetingChromeLayout } from '~/co-work/lib/meeting-orientation-layout'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

export type MeetingUiMode = 'normal' | 'maximized'

/** Idle delay before chrome auto-hides in immersive layouts. */
export const MEETING_CONTROLS_IDLE_MS = 3500

export type MeetingChromeVisibilityInput = {
  uiMode: MeetingUiMode
  viewMode: MeetingViewMode
  /** Side panel open (chat / people / invite / …). */
  panelOpen: boolean
  waitingCount: number
  busy?: boolean
  /** Host explicitly pinned chrome open. */
  controlsPinned?: boolean
}

/**
 * Auto-hide is appropriate during maximized / screen-share immersion.
 * Never auto-hide while a panel is open, someone is waiting, or exit is in progress.
 */
export function shouldAutoHideMeetingControls(input: MeetingChromeVisibilityInput): boolean {
  if (input.controlsPinned) return false
  if (input.panelOpen) return false
  if (input.waitingCount > 0) return false
  if (input.busy) return false
  if (input.uiMode === 'maximized') return true
  if (input.viewMode === 'screen-share') return true
  return false
}

/** Critical exit actions stay reachable via a peek affordance when chrome is hidden. */
export function meetingCriticalControlsAlwaysReachable(): true {
  return true
}

export type MeetingChromePadding = Pick<
  MeetingChromeLayout,
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
 * Maximized mode expands the video/share plane; hidden controls reclaim that chrome.
 * Safe-area insets from the base chrome are preserved.
 */
export function resolveMeetingUiChromePadding(input: {
  chrome: MeetingChromeLayout
  uiMode: MeetingUiMode
  controlsVisible: boolean
  safeTop?: number
  safeBottom?: number
}): MeetingChromePadding {
  const { chrome, uiMode, controlsVisible } = input
  const safeTop = Math.max(input.safeTop ?? 0, 0)
  const safeBottom = Math.max(input.safeBottom ?? 0, 0)

  if (uiMode === 'normal' && controlsVisible) {
    return {
      stagePaddingTop: chrome.stagePaddingTop,
      stagePaddingBottom: chrome.stagePaddingBottom,
      headerClearance: chrome.headerClearance,
      controlsClearance: chrome.controlsClearance,
      panelTop: chrome.panelTop,
      panelBottom: chrome.panelBottom,
      captionTopOffset: chrome.captionTopOffset,
      captionBottomOffset: chrome.captionBottomOffset,
    }
  }

  if (uiMode === 'maximized' && controlsVisible) {
    const headerClearance = Math.max(56, Math.round(chrome.headerClearance * 0.72))
    const controlsClearance = Math.max(72, Math.round(chrome.controlsClearance * 0.78))
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

  // Maximized (or immersive share) with minimal chrome — max video area.
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

export function applyMeetingUiChromeLayout(
  chrome: MeetingChromeLayout,
  padding: MeetingChromePadding,
): MeetingChromeLayout {
  return {
    ...chrome,
    ...padding,
  }
}
