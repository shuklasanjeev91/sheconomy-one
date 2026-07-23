import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useState } from 'react'

import { PageContent, LAYOUT_STRETCH } from '~/components/layout'
import { IdleMount } from '~/components/IdleMount'
import { DevicePrepCard } from '~/co-work/components/DevicePrepCard'
import { UpcomingMeetingsStrip } from '~/co-work/components/UpcomingMeetingsStrip'
import {
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkFeatureCard, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { createMeeting } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'

import { BRAND_NAME, BRAND_COWORK_LABEL } from '~/config/brand'

function CoWorkQuickStat({
  icon: Icon,
  label,
}: {
  icon: typeof Icons.Video
  label: string
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <XStack
      gap={8}
      alignItems="center"
      paddingHorizontal={14}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      backgroundColor={coworkUi.surfaceMuted}
    >
      <Icon size={15} color={coworkUi.brandLight} />
      <Text fontSize={12} fontWeight="700" color={coworkUi.textSecondary} letterSpacing={0.2}>
        {label}
      </Text>
    </XStack>
  )
}

function buildFeatures(brandLight: string) {
  return [
    {
      icon: <Icons.Video size={20} color={brandLight} />,
      title: 'HD video',
      description: `Crystal-clear meetings powered by ${BRAND_NAME} SFU.`,
    },
    {
      icon: <Icons.ScreenShare size={20} color={brandLight} />,
      title: 'Screen share',
      description: 'Present slides, docs, or your screen in one click.',
    },
    {
      icon: <Icons.MessageSquare size={20} color={brandLight} />,
      title: 'Live chat',
      description: 'Message everyone in the room without interrupting.',
    },
    {
      icon: <Icons.Shield size={20} color={brandLight} />,
      title: 'Host controls',
      description: 'Waiting room, mute all, and secure passcodes.',
    },
  ] as const
}

export function CoWorkScreen() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const features = buildFeatures(coworkUi.brandLight)
  const router = useRouter()
  const toast = useAppToast()
  const { user, profile, isAuthenticated } = useProfile()
  const { isDesktop } = useAppLayout()
  const recentCodes = useRecentMeetingCodes()
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0)

  async function startInstantMeeting() {
    if (!user) return
    setCreating(true)
    try {
      const hostLabel = profile?.full_name?.trim() || profile?.username?.trim() || BRAND_NAME
      const meeting = await createMeeting(user.id, {
        title: `${hostLabel} meeting`,
        startNow: true,
      })
      if (!meeting.meeting_code) {
        throw new Error('Meeting was created without a join code. Please try again.')
      }
      recordMeetingCode(meeting.meeting_code)
      router.push(coWorkRoutes.meetingLive(meeting.meeting_code))
    } catch (createError) {
      toast.show('Could not start meeting', {
        tone: 'error',
        message: createError instanceof Error ? createError.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  function joinWithCode(code: string) {
    const normalized = code.replace(/\s/g, '').toUpperCase()
    if (!normalized) return
    recordMeetingCode(normalized)
    router.push(coWorkRoutes.meeting(normalized))
  }

  function joinWithCode(code: string) {
    const normalized = code.replace(/\s/g, '').toUpperCase()
    if (!normalized) return
    recordMeetingCode(normalized)
    router.push(coWorkRoutes.meeting(normalized))
  }

  return (
    <PageContent
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
      onRefresh={() => setMeetingsRefreshKey((key) => key + 1)}
    >
      <YStack gap="$7" width="100%" {...LAYOUT_STRETCH}>
        <IdleMount>
          <DevicePrepCard />
          <UpcomingMeetingsStrip refreshKey={meetingsRefreshKey} />
        </IdleMount>
        <YStack gap="$4" position="relative">
          <CoWorkBrandChip label={BRAND_COWORK_LABEL} />
          <Text
            fontSize={isDesktop ? 40 : 32}
            fontWeight="800"
            color={coworkUi.text}
            letterSpacing={-1.2}
            lineHeight={isDesktop ? 46 : 38}
            maxWidth="100%"
          >
            Professional meetings, built for your community
          </Text>
          <Text fontSize={16} color={coworkUi.textSecondary} lineHeight={25}>
            Host branded video rooms with chat, screen sharing, waiting room, hand raise, and host controls — all in
            one {BRAND_NAME} experience.
          </Text>
          <XStack gap="$3" flexWrap="wrap" paddingTop="$1">
            <CoWorkQuickStat icon={Icons.Video} label="HD video" />
            <CoWorkQuickStat icon={Icons.Shield} label="Secure rooms" />
            <CoWorkQuickStat icon={Icons.Users} label="Host controls" />
          </XStack>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          {isAuthenticated ? (
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              icon={creating ? <Spinner size="small" color="white" /> : <Icons.Video size={18} color="white" />}
              disabled={creating}
              onPress={() => void startInstantMeeting()}
              style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
            >
              Start instant meeting
            </Button>
          ) : null}
          <AppLink href={coWorkRoutes.schedule} asChild>
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              icon={<Icons.Calendar size={18} color={coworkUi.text} />}
            >
              Schedule
            </Button>
          </AppLink>
          <AppLink href={coWorkRoutes.meetings} asChild>
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              icon={<Icons.Video size={18} color={coworkUi.text} />}
            >
              My meetings
            </Button>
          </AppLink>
        </XStack>

        <YStack
          gap="$3"
          padding="$4"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={{
            ...coworkGlassStyle(coworkUi, true),
            ...coworkBoxShadow(coworkShadows, 'card'),
          }}
        >
          <XStack alignItems="center" gap="$3">
            <CoWorkIconBadge icon={Icons.Hash} />
            <YStack flex={1} gap={2}>
              <Text fontWeight="800" fontSize={17} color={coworkUi.text}>
                Join with a code
              </Text>
              <Text fontSize={13} color={coworkUi.textSecondary}>
                Or use the Join tab in the bottom bar
              </Text>
            </YStack>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            <Input
              flex={1}
              minWidth={200}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="ABC DEF GHI"
              autoCapitalize="characters"
              backgroundColor={coworkUi.surfaceMuted}
              borderColor={coworkUi.borderSoft}
              color={coworkUi.text}
              placeholderTextColor={coworkUi.textMuted}
              borderRadius={14}
            />
            <Button tone="primary" borderRadius={14} onPress={() => joinWithCode(joinCode)}>
              Join meeting
            </Button>
          </XStack>
          {recentCodes.length > 0 ? (
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <Text fontSize={12} fontWeight="600" color={coworkUi.textMuted}>
                Recent
              </Text>
              {recentCodes.slice(0, 4).map((code) => (
                <XStack
                  key={code}
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                  backgroundColor="rgba(255,255,255,0.04)"
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

        <YStack gap="$3">
          <Text fontWeight="800" fontSize={18} color={coworkUi.text} letterSpacing={-0.3}>
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