import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { YStack } from '~/components/ui'
import {
  closeInstantMeetingSession,
  useInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { MeetingLiveScreen } from '~/co-work/screens/MeetingLiveScreen'

/**
 * Renders the live room over Co-Work UI when an instant session is open.
 * Avoids navigating to `/meeting/:code?live=1` — that async route chunk
 * blanked under Suspense on native Release every time.
 *
 * Imported only from Co-Work screens (not AppShell) so LiveKit stays out of
 * cold start / commerce home.
 */
export function CoWorkLiveMeetingGate({ children }: { children: ReactNode }) {
  const session = useInstantMeetingSession()

  if (!session) return <>{children}</>

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      backgroundColor="#0c080a"
      position={Platform.OS === 'web' ? ('relative' as const) : 'relative'}
    >
      <AppErrorBoundary scope="InstantMeeting" alwaysShowError>
        <MeetingLiveScreen
          code={session.code}
          initialMeeting={session.meeting}
          autoJoin={session.autoJoin || session.enteredRoom}
          resumeEnteredRoom={session.enteredRoom}
          resumeDisplayName={session.displayName}
          onExit={closeInstantMeetingSession}
        />
      </AppErrorBoundary>
    </YStack>
  )
}
