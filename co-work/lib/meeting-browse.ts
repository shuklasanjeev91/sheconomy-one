import {
  openInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import type { Meeting } from '~/co-work/lib/types'
import {
  minimizeGlobalSession,
  peekGlobalSession,
  peekGlobalSessionHandlers,
} from '~/lib/session/global-session'
import { clearImageCropQueue } from '~/lib/media/crop-session'
import { navigateApp } from '~/lib/platform/navigate'
import type { Href } from 'one'

/**
 * Keep LiveKit alive under InstantMeetingHost, collapse to the mini-player, and
 * optionally navigate so Commerce / Community / Chat / Class tabs are usable.
 *
 * Important: do not navigate inside browseAway/minimizeMeeting when a tab href
 * is provided — the caller navigates once to the requested tab.
 */
export function collapseLiveMeetingForBrowsing(input?: {
  code?: string
  meeting?: Meeting | null
  href?: Href | string | null
}): void {
  clearImageCropQueue()
  const browseAway = peekGlobalSessionHandlers().browseAway
  if (browseAway) {
    // Prefer handler collapse (marks enteredRoom + minimize). Avoid double
    // navigateApp(home) racing the tab target below.
    void browseAway()
  } else {
    const global = peekGlobalSession()
    const instant = peekInstantMeetingSession()
    const code = (input?.code ?? instant?.code ?? global?.code ?? '').replace(/\s/g, '').trim()
    if (code) {
      openInstantMeetingSession({
        code,
        meeting: input?.meeting ?? instant?.meeting ?? null,
        autoJoin: true,
        enteredRoom: true,
        displayName: instant?.displayName ?? null,
      })
    }
    minimizeGlobalSession()
  }

  if (input?.href) {
    navigateApp(input.href as Href)
  }
}

/** True when a live meeting is covering the app and should yield to tab navigation. */
export function shouldCollapseMeetingBeforeNavigate(): boolean {
  const session = peekGlobalSession()
  if (session?.kind === 'meeting' && session.presentation === 'fullscreen') return true
  if (session?.presentation === 'minimized' || session?.presentation === 'pip') return false
  // Instant lobby / live overlay without a registered global session yet.
  const instant = peekInstantMeetingSession()
  return !!instant?.enteredRoom
}
