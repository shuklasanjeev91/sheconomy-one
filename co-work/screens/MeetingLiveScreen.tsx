import { useCallback, useEffect, useRef, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { ScreenCenter } from '~/components/layout'
import { Button, Spinner, Text, YStack } from '~/components/ui'
import { ensureMeetingMobilePermissions } from '~/co-work/lib/meeting-media-permissions'
import {
  loadRememberedMeetingDisplayName,
  safeMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'
import { normalizeInstantMeetingCode } from '~/co-work/lib/instant-meeting-session'
import {
  fetchMeetingByCode,
  fetchMeetingModerationSettings,
  formatMeetingCode,
  verifyMeetingPasscode,
} from '~/co-work/lib/meetings'
import {
  MEETING_LOCKED_MESSAGE,
  shouldPromptForPasscode,
} from '~/co-work/lib/meeting-security'
import type { Meeting } from '~/co-work/lib/types'
import { MeetingRoomScreen } from '~/co-work/screens/MeetingRoomScreen'
import { MeetingJoinScreen } from '~/co-work/components/MeetingJoinScreen'
import { MeetingProvider } from '~/co-work/components/MeetingProvider'
import { useSyncMeetingLifecycle } from '~/co-work/hooks/useMeetingStateManager'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { useProfile } from '~/hooks/useProfile'
import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { coWorkRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

type MeetingLiveScreenProps = {
  code: string
  /** When opening from Co-Work create/start, skip the code lookup. */
  initialMeeting?: Meeting | null
  /**
   * Zoom-style: skip the second Join Meeting confirm when the caller already
   * previewed devices / granted permissions (instant start, lobby Join now).
   * Still shows confirm when a passcode is required or auto-join fails.
   */
  autoJoin?: boolean
  /**
   * InstantMeetingHost already entered the live room — Maximize must resume
   * MeetingRoomScreen, never the Join confirm lobby.
   */
  resumeEnteredRoom?: boolean
  resumeDisplayName?: string | null
  /** Overlay / in-place host: close session instead of relying on route alone. */
  onExit?: () => void
}

/**
 * Instant / live meeting entry: load → confirm identity/devices → permissions → room.
 * Kept separate from the lobby so LiveKit only loads on the live path.
 * Owns MeetingProvider so LOBBY → JOINING → room states stay centralized.
 */
export function MeetingLiveScreen(props: MeetingLiveScreenProps) {
  return (
    <MeetingProvider>
      <MeetingLiveScreenBody {...props} />
    </MeetingProvider>
  )
}

function MeetingLiveScreenBody({
  code,
  initialMeeting = null,
  autoJoin = false,
  resumeEnteredRoom = false,
  resumeDisplayName = null,
  onExit,
}: MeetingLiveScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const userId = user?.id
  // Once the InstantMeetingHost marks the room entered, never bounce back to
  // the Join confirm screen on remount / Maximize.
  const shouldResumeRoom = resumeEnteredRoom
  const shouldSkipConfirm = autoJoin || shouldResumeRoom
  const [meeting, setMeeting] = useState<Meeting | null>(initialMeeting)
  const [phase, setPhase] = useState<'loading' | 'confirm' | 'joining' | 'ready' | 'error'>(() => {
    if (shouldResumeRoom) return initialMeeting ? 'ready' : 'loading'
    if (!initialMeeting) return 'loading'
    return shouldSkipConfirm ? 'joining' : 'confirm'
  })
  const [error, setError] = useState<string | null>(null)
  const [confirmedDisplayName, setConfirmedDisplayName] = useState(
    () => resumeDisplayName?.trim() || '',
  )
  const [isLocked, setIsLocked] = useState(false)
  const [passcodeVerified, setPasscodeVerified] = useState(false)
  const [joinAudioEnabled, setJoinAudioEnabled] = useState(true)
  const [joinVideoEnabled, setJoinVideoEnabled] = useState(true)
  const loadedCodeRef = useRef<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const resumedRoomRef = useRef(shouldResumeRoom)

  const normalizedCode = normalizeInstantMeetingCode(code)
  const isHost = !!meeting && !!userId && meeting.host_id === userId
  const needsPasscode =
    !!meeting &&
    shouldPromptForPasscode({
      security: meeting.security_settings,
      isHost,
    }) &&
    !passcodeVerified

  useSyncMeetingLifecycle({
    inLobby: phase === 'confirm' || phase === 'loading',
    joining: phase === 'joining',
    locked: isLocked && !isHost && (phase === 'error' || phase === 'confirm'),
  })

  const exitMeeting = useCallback(() => {
    onExit?.()
    navigateApp(coWorkRoutes.home)
  }, [onExit])

  const applyMeetingSecurity = useCallback(
    async (row: Meeting) => {
      const moderation = await fetchMeetingModerationSettings(row.id).catch(() => null)
      const locked = !!moderation?.is_locked
      setIsLocked(locked)
      const hostViewer = !!userId && row.host_id === userId
      if (locked && !hostViewer) {
        setPhase('error')
        setError(MEETING_LOCKED_MESSAGE)
        return false
      }
      setPasscodeVerified(
        !shouldPromptForPasscode({
          security: row.security_settings,
          isHost: hostViewer,
        }),
      )
      return true
    },
    [userId],
  )

  const loadMeeting = useCallback(async () => {
    if (!normalizedCode) {
      setPhase('error')
      setError('Missing meeting code. Go back to Co-Work and try again.')
      return
    }

    if (
      initialMeeting &&
      normalizeInstantMeetingCode(initialMeeting.meeting_code) === normalizedCode
    ) {
      if (initialMeeting.status === 'cancelled') {
        setPhase('error')
        setError('The host cancelled this meeting.')
        return
      }
      // Paint immediately from session cache, then refresh so ended→reopen
      // does not keep a stale "active" row that skips host restart.
      setMeeting(initialMeeting)
      const ok = await applyMeetingSecurity(initialMeeting)
      if (ok) {
        setPhase((prev) => {
          if (prev === 'ready' || prev === 'joining') return prev
          if (shouldResumeRoom || resumedRoomRef.current) return 'ready'
          return shouldSkipConfirm ? 'joining' : 'confirm'
        })
      }
      void fetchMeetingByCode(normalizedCode)
        .then((row) => {
          if (!row || row.status === 'cancelled') return
          setMeeting(row)
        })
        .catch(() => {
          // Keep cached meeting — join path refreshes status via startMeeting.
        })
      return
    }

    setPhase((prev) => (prev === 'ready' || prev === 'joining' ? prev : 'loading'))
    setError(null)
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
      const ok = await applyMeetingSecurity(row)
      if (ok) {
        setPhase((prev) => {
          if (prev === 'ready' || prev === 'joining') return prev
          if (shouldResumeRoom || resumedRoomRef.current) return 'ready'
          return shouldSkipConfirm ? 'joining' : 'confirm'
        })
      }
    } catch (loadError) {
      setPhase('error')
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    }
  }, [normalizedCode, initialMeeting, applyMeetingSecurity, shouldSkipConfirm, shouldResumeRoom])

  const joinMeeting = useCallback(
    async (
      displayName: string,
      passcode?: string,
      options?: {
        skipPermissionPrompt?: boolean
        audioEnabled?: boolean
        videoEnabled?: boolean
      },
    ) => {
      if (!meeting) throw new Error('Meeting not loaded')
      if (isLocked && !isHost) {
        throw new Error(MEETING_LOCKED_MESSAGE)
      }
      if (
        shouldPromptForPasscode({
          security: meeting.security_settings,
          isHost,
        }) &&
        !passcodeVerified
      ) {
        const ok = await verifyMeetingPasscode(meeting.id, passcode ?? '')
        if (!ok) throw new Error('Incorrect passcode')
        setPasscodeVerified(true)
      }

      setPhase('joining')
      setError(null)
      // Resume / Maximize must not re-prompt permissions — that bounced users to Join.
      // Instant "New" already requested mic in the click gesture; skip a second prompt
      // that can hang behind the fullscreen overlay on web.
      if (!shouldResumeRoom && !resumedRoomRef.current && !options?.skipPermissionPrompt) {
        const permissions = await ensureMeetingMobilePermissions({
          requestNotifications: false,
        })
        if (!permissions.ok) {
          const message = permissions.message ?? 'Microphone permission is required to join.'
          // Stay on the join confirm screen so the user can open Settings and retry.
          // Never escalate a permission denial into an uncaught crash.
          setError(message)
          setPhase('confirm')
          throw new Error(message)
        }
      }
      if (typeof options?.audioEnabled === 'boolean') {
        setJoinAudioEnabled(options.audioEnabled)
      }
      if (typeof options?.videoEnabled === 'boolean') {
        setJoinVideoEnabled(options.videoEnabled)
      }
      setConfirmedDisplayName(displayName)
      resumedRoomRef.current = true
      setPhase('ready')
    },
    [isHost, isLocked, meeting, passcodeVerified, shouldResumeRoom],
  )

  useEffect(() => {
    if (!normalizedCode) {
      void loadMeeting()
      return
    }
    // Load once per meeting code — avoid setPhase loops when profile identity churns.
    if (loadedCodeRef.current === normalizedCode) return
    loadedCodeRef.current = normalizedCode
    void loadMeeting()
  }, [loadMeeting, normalizedCode])

  // Zoom-style one-tap: after load, enter the room without a second Join click.
  // Resume path (minimize → maximize) already landed on ready with a display name.
  useEffect(() => {
    if ((shouldResumeRoom || resumedRoomRef.current) && meeting && phase !== 'ready' && phase !== 'error') {
      resumedRoomRef.current = true
      setPhase('ready')
      if (!confirmedDisplayName.trim()) {
        setConfirmedDisplayName(
          safeMeetingDisplayName(resumeDisplayName || profile?.full_name || profile?.username),
        )
      }
      return
    }
    if ((shouldResumeRoom || resumedRoomRef.current) && phase === 'ready') {
      resumedRoomRef.current = true
      if (!confirmedDisplayName.trim()) {
        setConfirmedDisplayName(
          safeMeetingDisplayName(resumeDisplayName || profile?.full_name || profile?.username),
        )
      }
      return
    }
    if (!shouldSkipConfirm || autoJoinAttemptedRef.current) return
    if (!meeting || !user || !isAuthenticated) return
    if (phase !== 'joining' && phase !== 'confirm') return
    if (isLocked && !isHost) return
    if (needsPasscode) {
      // Passcode still needs the confirm UI.
      if (phase === 'joining') setPhase('confirm')
      return
    }

    autoJoinAttemptedRef.current = true
    // Do not abort on effect cleanup. Dependency churn (joinMeeting identity,
    // profile hydration) used to cancel before joinMeeting ran and left the UI
    // stuck on "Joining meeting…" forever because autoJoinAttemptedRef stayed true.
    void (async () => {
      const remembered = await loadRememberedMeetingDisplayName()
      const name = safeMeetingDisplayName(
        resumeDisplayName || remembered || profile?.full_name || profile?.username,
      )
      try {
        await joinMeeting(name, undefined, { skipPermissionPrompt: true })
      } catch {
        // joinMeeting already restored confirm + error — user can tap Join once.
        // Allow a later manual retry from the confirm screen.
        autoJoinAttemptedRef.current = false
      }
    })()
  }, [
    shouldSkipConfirm,
    shouldResumeRoom,
    resumeDisplayName,
    confirmedDisplayName,
    meeting,
    user,
    isAuthenticated,
    phase,
    isLocked,
    isHost,
    needsPasscode,
    profile?.full_name,
    profile?.username,
    joinMeeting,
  ])

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

  if (phase === 'confirm' && meeting && !shouldResumeRoom && !resumedRoomRef.current) {
    return (
      <MeetingJoinScreen
        meetingTitle={meeting.title}
        meetingCode={formatMeetingCode(meeting.meeting_code)}
        profileName={profile?.full_name || profile?.username || 'Guest'}
        email={user.email ?? null}
        avatarUrl={profile?.avatar_url}
        userId={user.id}
        requirePasscode={needsPasscode}
        isLocked={isLocked && !isHost}
        lockedMessage={MEETING_LOCKED_MESSAGE}
        onJoin={joinMeeting}
        onBack={exitMeeting}
      />
    )
  }

  if ((phase === 'ready' || shouldResumeRoom || resumedRoomRef.current) && meeting) {
    return (
      <MeetingRoomScreen
        meeting={meeting}
        userId={user.id}
        displayName={confirmedDisplayName || profile?.full_name || profile?.username || 'Guest'}
        avatarUrl={profile?.avatar_url}
        isHost={meeting.host_id === user.id}
        initialAudioEnabled={joinAudioEnabled}
        initialVideoEnabled={joinVideoEnabled}
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
    <ScreenCenter backgroundColor={coworkUi.pageBg}>
      <Spinner size="large" color={coworkUi.brand} />
      <Text color={coworkUi.textSecondary} marginTop="$3">
        {phase === 'joining' ? 'Joining meeting…' : 'Opening meeting…'}
      </Text>
    </ScreenCenter>
  )
}
