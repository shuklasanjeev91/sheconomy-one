import { SessionMiniPlayer, SessionPipWindow } from '~/components/session/SessionMiniPlayer'
import { useAndroidPipActive } from '~/lib/session/android-pip'
import { useGlobalSession } from '~/lib/session/global-session'

/**
 * AppShell overlay — shows the mini-player whenever a live session is minimized
 * or in OS Picture-in-Picture return mode. On Android PiP the app window itself
 * is the PiP window, so it shows the video-only view instead.
 */
export function GlobalSessionHost() {
  const session = useGlobalSession()
  const androidPip = useAndroidPipActive()
  if (!session) return null
  if (androidPip) return <SessionPipWindow session={session} />
  if (session.presentation !== 'minimized' && session.presentation !== 'pip') return null
  return <SessionMiniPlayer session={session} />
}
