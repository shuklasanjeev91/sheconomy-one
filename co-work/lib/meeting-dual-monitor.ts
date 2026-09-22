/**
 * Dual-monitor / pop-out helpers for Zoom-web-style secondary windows.
 * Native platforms no-op (single window).
 */

export function canOpenMeetingPopout(): boolean {
  return typeof window !== 'undefined' && typeof window.open === 'function'
}

export function meetingPopoutQueryFlag(): string {
  return 'popout'
}

/** True when this window should render Zoom-style secondary-monitor stage chrome. */
export function isMeetingPopoutMode(search?: string): boolean {
  try {
    const raw =
      search ??
      (typeof window !== 'undefined' ? window.location.search : '')
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`)
    return params.get(meetingPopoutQueryFlag()) === '1'
  } catch {
    return false
  }
}

export function openMeetingStagePopout(input: {
  meetingId: string
  title?: string
}): Window | null {
  if (!canOpenMeetingPopout()) return null
  const url = `${window.location.origin}/co-work/meeting/${encodeURIComponent(input.meetingId)}?${meetingPopoutQueryFlag()}=1`
  const features = 'popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
  const win = window.open(url, `sheconomy-meeting-${input.meetingId}`, features)
  if (win && input.title) {
    try {
      win.document.title = input.title
    } catch {
      // Cross-origin / about:blank until navigation completes.
    }
  }
  return win
}
