import { useRouter } from 'one'
import { useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { PageContent, LAYOUT_STRETCH } from '~/components/layout'
import { IdleMount } from '~/components/IdleMount'
import { RecentMeetingRevisitStrip } from '~/co-work/components/RecentMeetingRevisitStrip'
import { UpcomingMeetingsStrip } from '~/co-work/components/UpcomingMeetingsStrip'
import {
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import { ensureMeetingMobilePermissions } from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkFeatureCard } from '~/co-work/components/CoWorkUi'
import { createMeeting, fetchMeetingByCode } from '~/co-work/lib/meetings'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'

import { BRAND_NAME } from '~/config/brand'

function HomeAction({
  label,
  icon: Icon,
  onPress,
  href,
  primary,
  busy,
}: {
  label: string
  icon: typeof Icons.Video
  onPress?: () => void
  href?: string
  primary?: boolean
  busy?: boolean
}) {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const router = useRouter()
  const handlePress = () => {
    if (busy) return
    if (onPress) onPress()
    else if (href) router.push(href as never)
  }
  return (
    <YStack alignItems="center" gap="$2" minWidth={96} flex={1}>
      <Button
        tone={primary ? 'primary' : 'outline'}
        width={64}
        height={64}
        padding={0}
        borderRadius={16}
        borderColor={primary ? 'transparent' : coworkUi.glassBorder}
        backgroundColor={primary ? coworkUi.brand : coworkUi.meetingControl}
        disabled={busy}
        onPress={handlePress}
        // Web: prevent accidental form submit / full document reload.
        {...({ type: 'button' } as object)}
        style={
          primary
            ? controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)
            : undefined
        }
        icon={
          busy ? (
            <Spinner size="small" color={primary ? '#fff' : coworkUi.text} />
          ) : (
            <Icon size={24} color={primary ? '#fff' : coworkUi.text} />
          )
        }
        accessibilityLabel={label}
      />
      <Text fontSize={13} fontWeight="700" color={coworkUi.text} textAlign="center">
        {label}
      </Text>
    </YStack>
  )
}

function buildFeatures(brandLight: string) {
  return [
    {
      icon: <Icons.Video size={20} color={brandLight} />,
      title: 'HD gallery for everyone',
      description: `1–100+ peers in one ${BRAND_NAME} room — Zoom-simple gallery & speaker views.`,
    },
    {
      icon: <Icons.ScreenShare size={20} color={brandLight} />,
      title: 'Screen share',
      description: 'Present slides, docs, or your screen in one click.',
    },
    {
      icon: <Icons.MessageSquare size={20} color={brandLight} />,
      title: 'In-meeting chat',
      description: 'Chat with everyone in the live room — private notes and host moderation included.',
    },
    {
      icon: <Icons.Shield size={20} color={brandLight} />,
      title: 'Host controls',
      description: 'Waiting room, mute all, polls, Q&A, and breakouts.',
    },
  ] as const
}

export function CoWorkScreen() {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const features = buildFeatures(coworkUi.brandLight)
  const router = useRouter()
  const toast = useAppToast()
  const { user, profile, isAuthenticated } = useProfile()
  const { isDesktop } = useAppLayout()
  const recentCodes = useRecentMeetingCodes()
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0)
  const [showJoinField, setShowJoinField] = useState(false)

  async function startInstantMeeting() {
    if (!user || creating) return
    setCreating(true)
    try {
      // Request media first while still in the click gesture (web browsers require it).
      const perms = await ensureMeetingMobilePermissions({ requestNotifications: false })
      if (!perms.ok) {
        toast.show('Microphone required', {
          tone: 'error',
          message: perms.message,
        })
        return
      }

      const hostLabel = profile?.full_name?.trim() || profile?.username?.trim() || BRAND_NAME
      const meeting = await createMeeting(user.id, {
        title: `${hostLabel} meeting`,
        startNow: true,
      })
      if (!meeting.meeting_code) {
        throw new Error('Meeting was created without a join code. Please try again.')
      }
      recordMeetingCode(meeting.meeting_code)
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
      })
    } catch (createError) {
      toast.show('Could not start meeting', {
        tone: 'error',
        message: createError instanceof Error ? createError.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  async function joinWithCode(code: string) {
    const normalized = code.replace(/\s/g, '').toUpperCase()
    if (!normalized || joining) return
    recordMeetingCode(normalized)
    setJoining(true)
    try {
      // Zoom-style: resolve the shared meeting + enter InstantMeetingHost so
      // every peer lands in the same LiveKit room_id (1–N concurrent joiners).
      const meeting = await fetchMeetingByCode(normalized)
      if (!meeting) {
        toast.show('Meeting not found', {
          tone: 'error',
          message: 'Check the code and try again.',
        })
        router.push(coWorkRoutes.meeting(normalized))
        return
      }
      if (meeting.status === 'cancelled') {
        toast.show('Meeting cancelled', {
          tone: 'error',
          message: 'The host cancelled this meeting.',
        })
        return
      }
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
      })
    } catch (joinError) {
      toast.show('Could not join meeting', {
        tone: 'error',
        message: joinError instanceof Error ? joinError.message : undefined,
      })
      router.push(coWorkRoutes.meeting(normalized))
    } finally {
      setJoining(false)
    }
  }

  return (
    <PageContent
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$5"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
      onRefresh={() => setMeetingsRefreshKey((key) => key + 1)}
    >
      <YStack gap="$6" width="100%" {...LAYOUT_STRETCH}>
        <YStack gap="$1">
          <Text
            fontSize={isDesktop ? 28 : 24}
            fontWeight="800"
            color={coworkUi.text}
            letterSpacing={-0.6}
          >
            Meetings
          </Text>
          <Text fontSize={14} color={coworkUi.textSecondary}>
            Start, join, or schedule — Zoom-simple, {BRAND_NAME}-ready
          </Text>
        </YStack>

        <XStack
          gap="$3"
          justifyContent="space-around"
          paddingVertical="$3"
          paddingHorizontal="$2"
          borderRadius={coworkUi.radius.panel}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={meetingBarStyle(coworkUi, true)}
        >
          {isAuthenticated ? (
            <HomeAction
              label="New"
              icon={Icons.Video}
              primary
              busy={creating}
              onPress={() => void startInstantMeeting()}
            />
          ) : null}
          <HomeAction
            label="Join"
            icon={Icons.Hash}
            onPress={() => setShowJoinField((open) => !open)}
          />
          <HomeAction label="Schedule" icon={Icons.Calendar} href={String(coWorkRoutes.schedule)} />
        </XStack>

        {showJoinField ? (
          <YStack
            gap="$3"
            padding="$4"
            borderRadius={coworkUi.radius.panel}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            style={meetingBarStyle(coworkUi)}
          >
            <Text fontWeight="700" fontSize={15} color={coworkUi.text}>
              Join with a code
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <Input
                flex={1}
                minWidth={180}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="ABC DEF GHI"
                autoCapitalize="characters"
                backgroundColor={coworkUi.meetingControl}
                borderColor={coworkUi.borderSoft}
                color={coworkUi.text}
                placeholderTextColor={coworkUi.textMuted}
                borderRadius={12}
              />
              <Button
                tone="primary"
                borderRadius={12}
                disabled={joining}
                onPress={() => void joinWithCode(joinCode)}
              >
                {joining ? 'Joining…' : 'Join'}
              </Button>
            </XStack>
            {recentCodes.length > 0 ? (
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                {recentCodes.slice(0, 4).map((code) => (
                  <XStack
                    key={code}
                    paddingHorizontal="$3"
                    paddingVertical="$1.5"
                    borderRadius={999}
                    borderWidth={1}
                    borderColor={coworkUi.borderSoft}
                    backgroundColor={coworkUi.meetingControl}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.85 }}
                    onPress={() => joinWithCode(code)}
                  >
                    <Text fontSize={12} fontWeight="700" color={coworkUi.text} letterSpacing={1}>
                      {code}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            ) : null}
          </YStack>
        ) : null}

        <IdleMount>
          <UpcomingMeetingsStrip refreshKey={meetingsRefreshKey} />
          <RecentMeetingRevisitStrip />
        </IdleMount>

        <AppLink href={coWorkRoutes.meetings} asChild>
          <Button tone="ghost" size="$3" alignSelf="flex-start">
            My meetings
          </Button>
        </AppLink>

        <YStack gap="$3" opacity={0.92}>
          <Text fontWeight="700" fontSize={15} color={coworkUi.meetingIconMuted} letterSpacing={-0.2}>
            Everything you need
          </Text>
          <XStack gap="$3" flexWrap="wrap">
            {features.map((feature) => (
              <CoWorkFeatureCard key={feature.title} {...feature} />
            ))}
          </XStack>
        </YStack>
      </YStack>
    </PageContent>
  )
}
