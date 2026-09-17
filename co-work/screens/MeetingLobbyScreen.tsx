import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useState, lazy, Suspense } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, ScreenCenter } from '~/components/layout'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
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
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

import { APP_LAYOUT } from '~/lib/layout/constants'
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
    // In-place host keeps the SPA shell mounted (no hard route reload).
    // autoJoin skips the second Join Meeting screen — lobby already previewed devices.
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
    })
  }

  async function addToCalendar() {
    const result = await addMeetingToDeviceCalendar(meeting!)
    if (result === 'cancelled') return
    toast.show(
      result === 'saved' || result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      { tone: result === 'saved' || result === 'opened' || result === 'shared' ? 'success' : 'danger' },
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

  return (
    <FullWidthLayout
      scroll
      backgroundColor={coworkUi.pageBg}
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$5" width="100%" maxWidth={APP_LAYOUT.maxFormWidth} alignSelf="center">
          <YStack gap="$3">
            <CoWorkBrandChip />
            <Text fontSize={30} fontWeight="800" color={coworkUi.text} letterSpacing={-0.8}>
              {meeting?.title ?? 'Join meeting'}
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={15}>
              {meeting
                ? formatMeetingCode(meeting.meeting_code)
                : (normalizedCode || code).toUpperCase()}
            </Text>
          </YStack>

          <MeetingOpenInApp meetingCode={normalizedCode || code} />

          {error ? (
            <YStack
              padding="$4"
              borderRadius={coworkUi.radius.card}
              borderWidth={1}
              borderColor="rgba(244,63,104,0.35)"
              backgroundColor={coworkUi.dangerMuted}
            >
              <Text color={coworkUi.danger}>{error}</Text>
            </YStack>
          ) : null}

          {meeting && !verified ? (
            <YStack
              gap="$4"
              padding="$5"
              borderRadius={coworkUi.radius.card}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              style={{
                ...coworkGlassStyle(coworkUi, true),
                ...coworkBoxShadow(coworkShadows, 'card'),
              }}
            >
              <XStack alignItems="center" gap="$3">
                <CoWorkIconBadge icon={Icons.Lock} />
                <YStack gap={2}>
                  <Text fontWeight="800" fontSize={17} color={coworkUi.text}>
                    Protected meeting
                  </Text>
                  <Text color={coworkUi.textSecondary} fontSize={13}>
                    Enter the passcode from your host to continue
                  </Text>
                </YStack>
              </XStack>
              <Field label="Passcode">
                <Input
                  value={passcode}
                  onChangeText={setPasscode}
                  secureTextEntry
                  backgroundColor="rgba(255,255,255,0.05)"
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              <Button tone="primary" borderRadius={999} onPress={() => void handleVerifyPasscode()}>
                Continue
              </Button>
            </YStack>
          ) : null}

          {meeting && verified && isMeetingJoinable(meeting) ? (
            <YStack
              gap="$4"
              padding="$5"
              borderRadius={coworkUi.radius.card}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              style={{
                ...coworkGlassStyle(coworkUi, true),
                ...coworkBoxShadow(coworkShadows, 'card'),
              }}
            >
              <Text color={coworkUi.textSecondary} fontSize={14}>
                Hosted by {meeting.host?.full_name || meeting.host?.username || BRAND_MEMBER_LABEL}
              </Text>
              <Suspense
                fallback={
                  <YStack alignItems="center" justifyContent="center" minHeight={160} gap="$2">
                    <Spinner size="small" color={coworkUi.brand} />
                    <Text fontSize={12} color={coworkUi.textMuted}>
                      Loading camera preview…
                    </Text>
                  </YStack>
                }
              >
                <MeetingBackgroundPreview userId={user?.id} />
              </Suspense>
              <XStack gap="$3" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  disabled={isLocked && !isHost}
                  opacity={isLocked && !isHost ? 0.55 : 1}
                  icon={<Icons.Video size={18} color="white" />}
                  onPress={enterLiveRoom}
                  style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
                >
                  {isLocked && !isHost ? 'Meeting locked' : 'Join now'}
                </Button>
                {isHost ? (
                  <Button
                    tone="outline"
                    size="$4"
                    borderRadius={999}
                    borderColor={coworkUi.borderAccent}
                    icon={<Icons.UserPlus size={18} color={coworkUi.brandLight} />}
                    onPress={() => setShowInvite((open) => !open)}
                  >
                    {showInvite ? 'Hide invites' : 'Invite people'}
                  </Button>
                ) : null}
                <Button
                  tone="outline"
                  size="$4"
                  borderRadius={999}
                  borderColor={coworkUi.glassBorder}
                  onPress={() => setShareOpen(true)}
                >
                  Share
                </Button>
                <Button
                  tone="outline"
                  size="$4"
                  borderRadius={999}
                  borderColor={coworkUi.glassBorder}
                  icon={<Icons.Calendar size={17} color={coworkUi.brand} />}
                  onPress={() => void addToCalendar()}
                >
                  Add to calendar
                </Button>
                <MeetingShareSheet
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                  meeting={meeting}
                />
              </XStack>

              {isHost && showInvite && user ? (
                <YStack
                  height={420}
                  borderRadius={coworkUi.radius.card}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                  overflow="hidden"
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
          ) : null}

          <AppLink href={coWorkRoutes.home} asChild>
            <Button tone="ghost">Open Co-Work</Button>
          </AppLink>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
