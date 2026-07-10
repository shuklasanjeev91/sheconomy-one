import { Link, useRouter } from 'one'
import { Platform } from 'react-native'
import { useCallback, useEffect, useState } from 'react'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingRoomScreen } from '~/co-work/screens/MeetingRoomScreen'
import {
  fetchMeetingByCode,
  formatMeetingCode,
  getMeetingShareUrl,
  verifyMeetingPasscode,
} from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

import { APP_LAYOUT } from '~/lib/layout/constants'

type MeetingLobbyScreenProps = {
  code: string
  startLive?: boolean
}

export function MeetingLobbyScreen({ code, startLive = false }: MeetingLobbyScreenProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const toast = useAppToast()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [passcode, setPasscode] = useState('')
  const [verified, setVerified] = useState(false)
  const [inRoom, setInRoom] = useState(startLive)
  const [error, setError] = useState<string | null>(null)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  const isHost = !!meeting && !!user && meeting.host_id === user.id
  const hostName = profile?.full_name || profile?.username || 'You'

  const load = useCallback(async () => {
    setLoadingMeeting(true)
    setError(null)
    try {
      const row = await fetchMeetingByCode(code)
      if (!row) {
        setError('Meeting not found. Check the code and try again.')
        setMeeting(null)
        return
      }
      if (row.status === 'ended') setError('This meeting has ended.')
      setMeeting(row)
      if (!row.security_settings?.passcode && !row.security_settings?.requirePasscode) setVerified(true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
    } finally {
      setLoadingMeeting(false)
    }
  }, [code])

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

  if (isLoading || loadingMeeting) {
    return (
      <PageCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
      </PageCenter>
    )
  }

  if (!isAuthenticated || !user) {
    return <RequireAuth redirectTo={startLive ? coWorkRoutes.meetingLive(code) : coWorkRoutes.meeting(code)} />
  }

  if (inRoom && meeting && meeting.status !== 'ended') {
    return (
      <MeetingRoomScreen
        meeting={meeting}
        userId={user.id}
        displayName={profile?.full_name || profile?.username || 'You'}
        avatarUrl={profile?.avatar_url}
        isHost={meeting.host_id === user.id}
      />
    )
  }

  return (
    <FullWidthLayout scroll backgroundColor={coworkUi.pageBg} style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$5" width="100%" maxWidth={APP_LAYOUT.maxFormWidth} alignSelf="center">
          <YStack gap="$3">
            <CoWorkBrandChip />
            <Text fontSize={30} fontWeight="800" color={coworkUi.text} letterSpacing={-0.8}>
              {meeting?.title ?? 'Join meeting'}
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={15}>
              {meeting ? formatMeetingCode(meeting.meeting_code) : code.toUpperCase()}
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

          {meeting && verified && !error?.includes('ended') ? (
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
                  onPress={() => setInRoom(true)}
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
                  onPress={async () => {
                    const url = getMeetingShareUrl(meeting.meeting_code)
                    const copied = await copyToClipboard(url)
                    if (copied) toast.show('Link copied', { tone: 'success' })
                  }}
                >
                  Copy link
                </Button>
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
                    onInviteesUpdated={(next) => setMeeting((current) => (current ? { ...current, invitees: next } : current))}
                  />
                </YStack>
              ) : null}
            </YStack>
          ) : null}

          <Link href={coWorkRoutes.home} asChild>
            <Button tone="ghost">Back to Co-Work</Button>
          </Link>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}