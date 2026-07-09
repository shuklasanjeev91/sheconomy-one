import { Link, useRouter } from 'one'
import { Platform } from 'react-native'
import { useState } from 'react'

import { PageContent } from '~/components/layout'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkFeatureCard, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { createMeeting } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'

import { BRAND_NAME, BRAND_COWORK_LABEL } from '~/config/brand'

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
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)

  async function startInstantMeeting() {
    if (!user) return
    setCreating(true)
    try {
      const meeting = await createMeeting(user.id, {
        title: `${profile?.full_name || BRAND_NAME}'s meeting`,
        startNow: true,
      })
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

  return (
    <PageContent
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <YStack gap="$7" width="100%">
        <YStack gap="$4" position="relative">
          <CoWorkBrandChip label={BRAND_COWORK_LABEL} />
          <Text
            fontSize={isDesktop ? 40 : 32}
            fontWeight="800"
            color={coworkUi.text}
            letterSpacing={-1.2}
            lineHeight={isDesktop ? 46 : 38}
            maxWidth={720}
          >
            Professional meetings, built for your community
          </Text>
          <Text fontSize={16} color={coworkUi.textSecondary} lineHeight={25} maxWidth={600}>
            Host branded video rooms with chat, screen sharing, waiting room, hand raise, and host controls — all in
            one {BRAND_NAME} experience.
          </Text>
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
          <Link href={coWorkRoutes.schedule} asChild>
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              icon={<Icons.Calendar size={18} color={coworkUi.text} />}
            >
              Schedule
            </Button>
          </Link>
          <Link href={coWorkRoutes.meetings} asChild>
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              borderColor={coworkUi.glassBorder}
              icon={<Icons.Video size={18} color={coworkUi.text} />}
            >
              My meetings
            </Button>
          </Link>
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
            <Button
              tone="primary"
              borderRadius={14}
              onPress={() => {
                const normalized = joinCode.replace(/\s/g, '').toUpperCase()
                if (!normalized) return
                router.push(coWorkRoutes.meeting(normalized))
              }}
            >
              Join meeting
            </Button>
          </XStack>
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