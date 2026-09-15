import { useCallback, useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { ScreenCenter } from '~/components/layout'
import { Button, Spinner, Text, YStack } from '~/components/ui'
import { ensureMeetingMediaPermissions } from '~/co-work/lib/meeting-media-permissions'
import { fetchMeetingByCode } from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import { MeetingRoomScreen } from '~/co-work/screens/MeetingRoomScreen'
import { MeetingJoinScreen } from '~/co-work/components/MeetingJoinScreen'
import { formatMeetingCode } from '~/co-work/lib/meetings'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { useProfile } from '~/hooks/useProfile'
import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { coWorkRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

type MeetingLiveScreenProps = {
  code: string
  /** When opening from Co-Work create/start, skip the code lookup. */
  initialMeeting?: Meeting | null
  /** Overlay / in-place host: close session instead of relying on route alone. */
  onExit?: () => void
}

/**
 * Instant / live meeting entry: load → confirm identity/devices → permissions → room.
 * Kept separate from the lobby so LiveKit only loads on the live path.
 */
export function MeetingLiveScreen({
  code,
  initialMeeting = null,
  onExit,
}: MeetingLiveScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const [meeting, setMeeting] = useState<Meeting | null>(initialMeeting)
  const [phase, setPhase] = useState<'loading' | 'confirm' | 'joining' | 'ready' | 'error'>(
    initialMeeting ? 'confirm' : 'loading',
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmedDisplayName, setConfirmedDisplayName] = useState('')

  const normalizedCode = code.replace(/\s/g, '').trim()

  const exitMeeting = useCallback(() => {
    onExit?.()
    navigateApp(coWorkRoutes.home)
  }, [onExit])

  const loadMeeting = useCallback(async () => {
    if (!normalizedCode) {
      setPhase('error')
      setError('Missing meeting code. Go back to Co-Work and try again.')
      return
    }

    setPhase('loading')
    setError(null)

    if (initialMeeting && initialMeeting.meeting_code.replace(/\s/g, '').trim() === normalizedCode) {
      if (initialMeeting.status === 'cancelled') {
        setPhase('error')
        setError('The host cancelled this meeting.')
        return
      }
      setMeeting(initialMeeting)
      setPhase('confirm')
      return
    }

    setPhase('loading')
    try {
      const row = await fetchMeetingByCode(normalizedCode)
      if (!row) {
        setPhase('error')
        setError('Meeting not found. Check the code and try again.')
        return
      }
      if (row.status === 'cancelled') {
        setPhase('error')
        setError('The host cancelled this meeting.')
        return
      }
      setMeeting(row)
      setPhase('confirm')
    } catch (loadError) {
      setPhase('error')
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    }
  }, [normalizedCode, initialMeeting])

  const joinMeeting = useCallback(async (displayName: string) => {
    setPhase('joining')
    setError(null)
    const permissions = await ensureMeetingMediaPermissions()
    if (!permissions.ok) {
      const message = permissions.message ?? 'Microphone permission is required to join.'
      setError(message)
      setPhase('error')
      throw new Error(message)
    }
    setConfirmedDisplayName(displayName)
    setPhase('ready')
  }, [])

  useEffect(() => {
    void loadMeeting()
  }, [loadMeeting])

  if (isLoading && !user) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Checking account…
        </Text>
      </ScreenCenter>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthSignInFlow returnTo={String(coWorkRoutes.meetingLive(normalizedCode || code))} />
  }

  if (phase === 'confirm' && meeting) {
    return (
      <MeetingJoinScreen
        meetingTitle={meeting.title}
        meetingCode={formatMeetingCode(meeting.meeting_code)}
        profileName={profile?.full_name || profile?.username || 'Guest'}
        email={user.email ?? null}
        avatarUrl={profile?.avatar_url}
        onJoin={joinMeeting}
        onBack={exitMeeting}
      />
    )
  }

  if (phase === 'ready' && meeting) {
    return (
      <MeetingRoomScreen
        meeting={meeting}
        userId={user.id}
        displayName={confirmedDisplayName || profile?.full_name || profile?.username || 'Guest'}
        avatarUrl={profile?.avatar_url}
        isHost={meeting.host_id === user.id}
        onLeave={exitMeeting}
      />
    )
  }

  if (phase === 'error') {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg} padding="$6" gap="$4">
        <Text fontSize={22} fontWeight="800" color={coworkUi.text} textAlign="center">
          Could not open meeting
        </Text>
        <Text color={coworkUi.danger} textAlign="center">
          {error ?? 'Something went wrong'}
        </Text>
        <YStack gap="$3" width="100%" maxWidth={360}>
          <Button
            tone="primary"
            borderRadius={999}
            onPress={() => {
              if (meeting) {
                setError(null)
                setPhase('confirm')
              } else {
                void loadMeeting()
              }
            }}
          >
            Try again
          </Button>
          {onExit ? (
            <Button tone="outline" borderRadius={999} onPress={exitMeeting}>
              Back to Co-Work
            </Button>
          ) : (
            <AppLink href={coWorkRoutes.home} asChild>
              <Button tone="outline" borderRadius={999}>
                Back to Co-Work
              </Button>
            </AppLink>
          )}
        </YStack>
      </ScreenCenter>
    )
  }

  return (
    <ScreenCenter backgroundColor="#0c080a">
      <Spinner size="large" color={coworkUi.brand} />
      <Text color={coworkUi.textSecondary} marginTop="$3" textAlign="center" paddingHorizontal="$6">
        {phase === 'joining' ? 'Checking camera and microphone…' : 'Loading meeting…'}
      </Text>
    </ScreenCenter>
  )
}
