import { SessionMiniPlayer } from '~/components/session/SessionMiniPlayer'
import { useGlobalSession } from '~/lib/session/global-session'

/**
 * AppShell overlay — shows the mini-player whenever a live session is minimized
 * or in OS Picture-in-Picture return mode.
 */
export function GlobalSessionHost() {
  const session = useGlobalSession()
  if (!session) return null
  if (session.presentation !== 'minimized' && session.presentation !== 'pip') return null
  return <SessionMiniPlayer session={session} />
}
