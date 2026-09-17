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
import { navigateApp } from '~/lib/platform/navigate'
import type { Href } from 'one'

/**
 * Keep LiveKit alive under InstantMeetingHost, collapse to the mini-player, and
 * optionally navigate so Commerce / Community / Chat / Class tabs are usable.
 */
export function collapseLiveMeetingForBrowsing(input?: {
  code?: string
  meeting?: Meeting | null
  href?: Href | string | null
}): void {
  const browseAway = peekGlobalSessionHandlers().browseAway
  if (browseAway) {
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
  const instant = peekInstantMeetingSession()
  if (!instant) return false
  return session?.presentation !== 'minimized' && session?.presentation !== 'pip'
}
