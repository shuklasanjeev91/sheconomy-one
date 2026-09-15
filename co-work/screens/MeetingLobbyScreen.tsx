import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, ScreenCenter } from '~/components/layout'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { ShareSheet } from '~/components/share'
import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { buildMeetingSharePayload } from '~/co-work/lib/meeting-share'
import {
  fetchMeetingByCode,
  formatMeetingCode,
  isMeetingJoinable,
  verifyMeetingPasscode,
} from '~/co-work/lib/meetings'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { navigateApp } from '~/lib/platform/navigate'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

import { APP_LAYOUT } from '~/lib/layout/constants'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'

type MeetingLobbyScreenProps = {
  code: string
}

/** Pre-join lobby only — live room is `/meeting/:code/live` (MeetingLiveScreen). */
export function MeetingLobbyScreen({ code }: MeetingLobbyScreenProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const toast = useAppToast()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [passcode, setPasscode] = useState('')
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const isHost = !!meeting && !!user && meeting.host_id === user.id
  const hostName = profile?.full_name || profile?.username || 'You'
  const normalizedCode = code.replace(/\s/g, '').trim()

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
      if (!row.security_settings?.passcode && !row.security_settings?.requirePasscode) {
        setVerified(true)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    } finally {
      setLoadingMeeting(false)
    }
  }, [normalizedCode])

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
    if (Platform.OS === 'web') {
      navigateApp(coWorkRoutes.meetingLive(meeting.meeting_code))
      return
    }
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
    })
  }

  async function addToCalendar() {
    if (!meeting?.scheduled_at && !meeting?.started_at) {
      toast.show('No time set for this meeting', { tone: 'info' })
      return
    }
    const result = await addMeetingToDeviceCalendar(meeting)
    if (result === 'cancelled') return
    toast.show(
      result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      { tone: result === 'opened' || result === 'shared' ? 'success' : 'danger' },
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
              <XStack gap="$3" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  icon={<Icons.Video size={18} color="white" />}
                  onPress={enterLiveRoom}
                  style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
                >
                  Join now
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
                {(meeting.scheduled_at || meeting.started_at) ? (
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
                ) : null}
                <ShareSheet
                  open={shareOpen}
                  onOpenChange={setShareOpen}
                  title="Share meeting"
                  copyLabel="Copy meeting link"
                  copyToastMessage="Meeting link copied to clipboard."
                  payload={buildMeetingSharePayload(meeting)}
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
