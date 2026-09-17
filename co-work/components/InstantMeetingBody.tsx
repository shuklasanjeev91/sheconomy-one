import { MeetingLiveScreen } from '~/co-work/screens/MeetingLiveScreen'
import type { InstantMeetingSession } from '~/co-work/lib/instant-meeting-session'

type InstantMeetingBodyProps = {
  session: InstantMeetingSession
  onExit: () => void
}

/** Live room body for InstantMeetingHost (keeps host file focused on overlay chrome). */
export function InstantMeetingBody({ session, onExit }: InstantMeetingBodyProps) {
  return (
    <MeetingLiveScreen
      code={session.code}
      initialMeeting={session.meeting}
      autoJoin={session.autoJoin}
      onExit={onExit}
    />
  )
}
