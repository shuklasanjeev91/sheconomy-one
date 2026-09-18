import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useState, lazy, Suspense } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, ScreenCenter } from '~/components/layout'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingOpenInApp } from '~/co-work/components/MeetingOpenInApp'
import { MeetingProvider } from '~/co-work/components/MeetingProvider'
import { useSyncMeetingLifecycle } from '~/co-work/hooks/useMeetingStateManager'
import {
  fetchMeetingByCode,
  fetchMeetingModerationSettings,
  formatMeetingCode,
  isMeetingJoinable,
  verifyMeetingPasscode,
} from '~/co-work/lib/meetings'
import {
  MEETING_LOCKED_MESSAGE,
  shouldPromptForPasscode,
} from '~/co-work/lib/meeting-security'
import {
  openInstantMeetingSession,
  peekInstantMeetingSession,
  instantMeetingCodesMatch,
} from '~/co-work/lib/instant-meeting-session'
import { maximizeGlobalSession } from '~/lib/session/global-session'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'

const MeetingBackgroundPreview = lazy(() =>
  import('~/co-work/components/MeetingBackgroundPreview').then((mod) => ({
    default: mod.MeetingBackgroundPreview,
  })),
)

type MeetingLobbyScreenProps = {
  code: string
}

/** Pre-join lobby only — live room is `/meeting/:code/live` (MeetingLiveScreen). */
export function MeetingLobbyScreen({ code }: MeetingLobbyScreenProps) {
  return (
    <MeetingProvider>
      <MeetingLobbyScreenBody code={code} />
    </MeetingProvider>
  )
}

function MeetingLobbyScreenBody({ code }: MeetingLobbyScreenProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const { isDesktop, isTablet } = useAppLayout()
  const wide = isDesktop || isTablet
  const toast = useAppToast()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [passcode, setPasscode] = useState('')
  const [verified, setVerified] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const isHost = !!meeting && !!user && meeting.host_id === user.id
  const hostName = profile?.full_name || profile?.username || 'You'
  const normalizedCode = code.replace(/\s/g, '').trim()

  useSyncMeetingLifecycle({
    inLobby: true,
    locked: isLocked && !isHost,
  })

  const load = useCallback(async () => {
    if (!normalizedCode) {
      setLoadingMeeting(false)
      setMeeting(null)
      setError('Missing meeting code. Go back to Co-Work and try again.')
      return
    }

    setLoadingMeeting(true)
    setError(null)
    try {
      const row = await fetchMeetingByCode(normalizedCode)
      if (!row) {
        setError('Meeting not found. Check the code and try again.')
        setMeeting(null)
        return
      }
      if (row.status === 'cancelled') setError('The host cancelled this meeting.')
      setMeeting(row)

      const moderation = await fetchMeetingModerationSettings(row.id).catch(() => null)
      const locked = !!moderation?.is_locked
      setIsLocked(locked)
      if (locked && row.host_id !== user?.id) {
        setError(MEETING_LOCKED_MESSAGE)
      }

      const hostViewer = !!user && row.host_id === user.id
      if (
        !shouldPromptForPasscode({
          security: row.security_settings,
          isHost: hostViewer,
        })
      ) {
        setVerified(true)
      } else {
        setVerified(false)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    } finally {
      setLoadingMeeting(false)
    }
  }, [normalizedCode, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleVerifyPasscode() {
    if (!meeting) return
    const ok = await verifyMeetingPasscode(meeting.id, passcode)
    if (!ok) {
      toast.show('Incorrect passcode', { tone: 'error' })
      return
    }
    setVerified(true)
  }

  function enterLiveRoom() {
    if (!meeting) return
    if (isLocked && !isHost) {
      toast.show('Meeting locked', { tone: 'danger', message: MEETING_LOCKED_MESSAGE })
      return
    }
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
    })
  }

  useEffect(() => {
    if (!meeting) return
    const instant = peekInstantMeetingSession()
    if (!instant?.enteredRoom) return
    if (!instantMeetingCodesMatch(instant.code, meeting.meeting_code)) return
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
      enteredRoom: true,
      displayName: instant.displayName,
    })
    maximizeGlobalSession()
  }, [meeting])

  async function addToCalendar() {
    const result = await addMeetingToDeviceCalendar(meeting!)
    if (result === 'cancelled') return
    toast.show(
      result === 'saved' || result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      {
        tone:
          result === 'saved' || result === 'opened' || result === 'shared' ? 'success' : 'danger',
      },
    )
  }

  if (loadingMeeting || (isLoading && !user)) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Loading meeting…
        </Text>
      </ScreenCenter>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthSignInFlow returnTo={String(coWorkRoutes.meeting(normalizedCode || code))} />
  }

  const joinReady = meeting && verified && isMeetingJoinable(meeting)
  const title = meeting?.title ?? 'Join meeting'
  const codeLabel = meeting
    ? formatMeetingCode(meeting.meeting_code)
    : (normalizedCode || code).toUpperCase()

  const sidebar = (
    <YStack gap="$4" flex={wide ? 1 : undefined} minWidth={wide ? 280 : undefined} maxWidth={wide ? 380 : undefined}>
      <YStack gap="$2">
        <Text fontSize={wide ? 28 : 26} fontWeight="800" color={coworkUi.text} letterSpacing={-0.6}>
          {title}
        </Text>
        <Text color={coworkUi.meetingIconMuted} fontSize={14} fontWeight="600" letterSpacing={1}>
          {codeLabel}
        </Text>
        {meeting ? (
          <Text color={coworkUi.textSecondary} fontSize={13}>
            Hosted by {meeting.host?.full_name || meeting.host?.username || BRAND_MEMBER_LABEL}
          </Text>
        ) : null}
      </YStack>

      <MeetingOpenInApp meetingCode={normalizedCode || code} />

      {error ? (
        <YStack
          padding="$3.5"
          borderRadius={coworkUi.radius.panel}
          borderWidth={1}
          borderColor="rgba(244,63,104,0.35)"
          backgroundColor={coworkUi.dangerMuted}
        >
          <Text color={coworkUi.danger}>{error}</Text>
        </YStack>
      ) : null}

      {meeting && !verified ? (
        <YStack gap="$3" padding="$4" borderRadius={coworkUi.radius.panel} style={meetingBarStyle(coworkUi, true)}>
          <XStack alignItems="center" gap="$3">
            <CoWorkIconBadge icon={Icons.Lock} />
            <YStack gap={2} flex={1}>
              <Text fontWeight="700" fontSize={15} color={coworkUi.text}>
                Passcode required
              </Text>
              <Text color={coworkUi.textSecondary} fontSize={12}>
                Enter the passcode from your host
              </Text>
            </YStack>
          </XStack>
          <Field label="Passcode">
            <Input
              value={passcode}
              onChangeText={setPasscode}
              secureTextEntry
              backgroundColor={coworkUi.meetingControl}
              borderColor={coworkUi.borderSoft}
              color={coworkUi.text}
              borderRadius={12}
            />
          </Field>
          <Button tone="primary" borderRadius={12} onPress={() => void handleVerifyPasscode()}>
            Continue
          </Button>
        </YStack>
      ) : null}

      {joinReady ? (
        <YStack gap="$3" width="100%">
          <Button
            tone="primary"
            size="$5"
            borderRadius={12}
            width="100%"
            disabled={isLocked && !isHost}
            opacity={isLocked && !isHost ? 0.55 : 1}
            icon={<Icons.Video size={18} color="white" />}
            onPress={enterLiveRoom}
            style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
          >
            {isLocked && !isHost ? 'Meeting locked' : 'Join'}
          </Button>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Button
              tone="outline"
              size="$3"
              borderRadius={12}
              borderColor={coworkUi.glassBorder}
              backgroundColor={coworkUi.meetingControl}
              onPress={() => setShareOpen(true)}
              icon={<Icons.Share2 size={15} color={coworkUi.text} />}
            >
              Share
            </Button>
            {isHost ? (
              <Button
                tone="outline"
                size="$3"
                borderRadius={12}
                borderColor={coworkUi.glassBorder}
                backgroundColor={coworkUi.meetingControl}
                icon={<Icons.UserPlus size={15} color={coworkUi.text} />}
                onPress={() => setShowInvite((open) => !open)}
              >
                {showInvite ? 'Hide invite' : 'Invite'}
              </Button>
            ) : null}
            <Button
              tone="ghost"
              size="$3"
              borderRadius={12}
              icon={<Icons.MoreHorizontal size={16} color={coworkUi.meetingIconMuted} />}
              onPress={() => setMoreOpen((open) => !open)}
            >
              More
            </Button>
          </XStack>
          {moreOpen ? (
            <YStack gap="$2">
              <Button
                tone="outline"
                size="$3"
                borderRadius={12}
                borderColor={coworkUi.glassBorder}
                icon={<Icons.Calendar size={15} color={coworkUi.text} />}
                onPress={() => void addToCalendar()}
              >
                Add to calendar
              </Button>
            </YStack>
          ) : null}
          <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting!} />
        </YStack>
      ) : null}

      <AppLink href={coWorkRoutes.home} asChild>
        <Button tone="ghost" size="$3">
          Back to Co-Work
        </Button>
      </AppLink>
    </YStack>
  )

  const preview = joinReady ? (
    <YStack
      flex={wide ? 1.65 : undefined}
      minHeight={wide ? 420 : undefined}
      padding="$4"
      gap="$3"
      borderRadius={coworkUi.radius.panel}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      // Do not clip — background tiles / Upload live below the camera preview.
      overflow="visible"
      style={{
        ...meetingBarStyle(coworkUi),
        ...coworkBoxShadow(coworkShadows, 'card'),
      }}
    >
      <Suspense
        fallback={
          <YStack flex={1} alignItems="center" justifyContent="center" minHeight={220} gap="$2">
            <Spinner size="small" color={coworkUi.brand} />
            <Text fontSize={12} color={coworkUi.textMuted}>
              Loading camera preview…
            </Text>
          </YStack>
        }
      >
        <MeetingBackgroundPreview userId={user?.id} />
      </Suspense>
    </YStack>
  ) : null

  return (
    <FullWidthLayout
      scroll
      backgroundColor={coworkUi.pageBg}
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <PageSection paddingVertical="$5" paddingBottom="$8" {...LAYOUT_STRETCH}>
        <YStack gap="$5" width="100%" maxWidth={wide ? 1100 : 520} alignSelf="center" paddingBottom="$6">
          {wide && joinReady ? (
            <XStack gap="$5" alignItems="stretch" width="100%">
              {preview}
              {sidebar}
            </XStack>
          ) : (
            <YStack gap="$4" width="100%">
              {preview}
              {sidebar}
            </YStack>
          )}

          {isHost && showInvite && user && meeting ? (
            <YStack
              height={360}
              borderRadius={coworkUi.radius.panel}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              overflow="hidden"
              style={meetingBarStyle(coworkUi, true)}
            >
              <MeetingInvitePanel
                meeting={meeting}
                hostId={user.id}
                hostName={hostName}
                onClose={() => setShowInvite(false)}
                fullWidth
                onInviteesUpdated={(next) =>
                  setMeeting((current) => (current ? { ...current, invitees: next } : current))
                }
              />
            </YStack>
          ) : null}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
