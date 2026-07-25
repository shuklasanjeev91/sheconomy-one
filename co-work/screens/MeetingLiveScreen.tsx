import { useCallback, useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { ScreenCenter } from '~/components/layout'
import { Button, Spinner, Text, YStack } from '~/components/ui'
import { ensureMeetingMediaPermissions } from '~/co-work/lib/meeting-media-permissions'
import { fetchMeetingByCode } from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import { MeetingRoomScreen } from '~/co-work/screens/MeetingRoomScreen'
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
 * Instant / live meeting entry: permissions → load meeting → join room.
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
  const [phase, setPhase] = useState<'permissions' | 'loading' | 'ready' | 'error'>(
    initialMeeting ? 'permissions' : 'permissions'
  )
  const [error, setError] = useState<string | null>(null)

  const normalizedCode = code.replace(/\s/g, '').trim()

  const exitMeeting = useCallback(() => {
    onExit?.()
    navigateApp(coWorkRoutes.home, { replace: true })
  }, [onExit])

  const boot = useCallback(async () => {
    if (!normalizedCode) {
      setPhase('error')
      setError('Missing meeting code. Go back to Co-Work and try again.')
      return
    }

    setPhase('permissions')
    setError(null)

    const perms = await ensureMeetingMediaPermissions()
    if (!perms.ok) {
      setPhase('error')
      setError(perms.message ?? 'Camera and microphone permission is required.')
      return
    }

    if (initialMeeting && initialMeeting.meeting_code.replace(/\s/g, '').trim() === normalizedCode) {
      if (initialMeeting.status === 'ended') {
        setPhase('error')
        setError('This meeting has ended.')
        return
      }
      setMeeting(initialMeeting)
      setPhase('ready')
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
      if (row.status === 'ended') {
        setPhase('error')
        setError('This meeting has ended.')
        return
      }
      setMeeting(row)
      setPhase('ready')
    } catch (loadError) {
      setPhase('error')
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    }
  }, [normalizedCode, initialMeeting])

  useEffect(() => {
    void boot()
  }, [boot])

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

  if (phase === 'ready' && meeting) {
    return (
      <MeetingRoomScreen
        meeting={meeting}
        userId={user.id}
        displayName={profile?.full_name || profile?.username || 'You'}
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
          <Button tone="primary" borderRadius={999} onPress={() => void boot()}>
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
        {phase === 'permissions'
          ? 'Allow camera and microphone to continue…'
          : 'Starting meeting…'}
      </Text>
    </ScreenCenter>
  )
}
