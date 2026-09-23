import { useState } from 'react'
import { useRouter } from 'one'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { ScreenFill } from '~/components/layout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'

type MeetingEndedScreenProps = {
  title?: string
  reason?: 'ended' | 'cancelled' | 'removed'
  /** ISO string when the meeting started — used to compute duration. */
  startedAt?: string | null
  /** Number of participants who attended. */
  participantCount?: number
  /** Whether to show a link to the recordings panel. */
  hasRecording?: boolean
  onDone: () => void
}

function formatDuration(startedAt: string | null | undefined): string | null {
  if (!startedAt) return null
  const ms = Date.now() - new Date(startedAt).getTime()
  if (ms <= 0) return null
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Shown after the host ends the meeting — full Zoom-style post-meeting summary. */
export function MeetingEndedScreen({
  title = 'Meeting ended',
  reason = 'ended',
  startedAt,
  participantCount,
  hasRecording,
  onDone,
}: MeetingEndedScreenProps) {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const { safeTop, safeBottom } = useAppLayout()
  const router = useRouter()
  const duration = formatDuration(startedAt)
  const [rating, setRating] = useState(0)
  const [ratingSaved, setRatingSaved] = useState(false)

  const subtitle =
    reason === 'cancelled'
      ? 'The meeting was cancelled by the host.'
      : reason === 'removed'
        ? 'You were removed from the meeting.'
        : 'The host has ended the meeting for all participants.'

  return (
    <ScreenFill
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      backgroundColor="#0c080a"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$5"
      paddingTop={Math.max(safeTop, 20)}
      paddingBottom={Math.max(safeBottom, 20)}
    >
      <YStack
        gap="$5"
        width="100%"
        maxWidth="100%"
        alignItems="center"
        padding="$6"
        borderRadius={24}
        borderWidth={1}
        borderColor="rgba(255, 255, 255, 0.10)"
        backgroundColor="rgba(20, 14, 22, 0.97)"
        style={{
          boxShadow: '0 24px 72px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Icon */}
        <YStack
          width={72}
          height={72}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(224, 30, 90, 0.12)"
          borderWidth={1}
          borderColor="rgba(224, 30, 90, 0.25)"
        >
          <Icons.Video size={30} color={coworkUi.brandLight} />
        </YStack>

        {/* Title + subtitle */}
        <YStack gap="$1.5" alignItems="center" width="100%">
          <Text
            fontSize={24}
            fontWeight="800"
            color="#ffffff"
            textAlign="center"
            letterSpacing={-0.4}
          >
            {title}
          </Text>
          <Text
            fontSize={14}
            color={coworkUi.textSecondary}
            textAlign="center"
            lineHeight={22}
            width="100%"
          >
            {subtitle}
          </Text>
        </YStack>

        {/* Meeting summary stats */}
        {(duration || participantCount) ? (
          <XStack
            gap="$3"
            width="100%"
            backgroundColor="rgba(255,255,255,0.04)"
            borderRadius={14}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.08)"
            padding="$4"
            justifyContent="center"
          >
            {duration ? (
              <YStack alignItems="center" gap={4} flex={1}>
                <XStack alignItems="center" gap="$1.5">
                  <Icons.Clock size={15} color={coworkUi.brandLight} />
                  <Text fontSize={20} fontWeight="800" color="#ffffff">
                    {duration}
                  </Text>
                </XStack>
                <Text fontSize={11} color={coworkUi.textMuted} fontWeight="500">
                  Duration
                </Text>
              </YStack>
            ) : null}

            {duration && participantCount ? (
              <YStack width={1} backgroundColor="rgba(255,255,255,0.10)" />
            ) : null}

            {participantCount ? (
              <YStack alignItems="center" gap={4} flex={1}>
                <XStack alignItems="center" gap="$1.5">
                  <Icons.Users size={15} color={coworkUi.brandLight} />
                  <Text fontSize={20} fontWeight="800" color="#ffffff">
                    {participantCount}
                  </Text>
                </XStack>
                <Text fontSize={11} color={coworkUi.textMuted} fontWeight="500">
                  Participant{participantCount !== 1 ? 's' : ''}
                </Text>
              </YStack>
            ) : null}
          </XStack>
        ) : null}

        {/* Recording notice */}
        {hasRecording ? (
          <XStack
            alignItems="center"
            gap="$2"
            backgroundColor="rgba(216, 27, 96, 0.08)"
            borderRadius={10}
            borderWidth={1}
            borderColor="rgba(216, 27, 96, 0.2)"
            paddingHorizontal="$3"
            paddingVertical="$2.5"
            width="100%"
          >
            <YStack
              width={26}
              height={26}
              borderRadius={999}
              backgroundColor="rgba(216, 27, 96, 0.15)"
              alignItems="center"
              justifyContent="center"
            >
              <YStack width={8} height={8} borderRadius={4} backgroundColor={coworkUi.danger} />
            </YStack>
            <YStack flex={1} gap={1}>
              <Text fontSize={13} fontWeight="700" color="#ffffff">
                Recording available
              </Text>
              <Text fontSize={11} color={coworkUi.textSecondary}>
                The cloud recording will appear in Recordings shortly.
              </Text>
            </YStack>
          </XStack>
        ) : null}

        {/* Zoom-style post-meeting quality feedback */}
        {reason === 'ended' ? (
          <YStack width="100%" gap="$2" alignItems="center">
            <Text fontSize={13} fontWeight="600" color={coworkUi.textSecondary}>
              {ratingSaved ? 'Thanks for your feedback' : 'How was the meeting quality?'}
            </Text>
            {!ratingSaved ? (
              <XStack gap="$2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    chromeless
                    circular
                    width={40}
                    height={40}
                    padding={0}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    onPress={() => {
                      setRating(star)
                      setRatingSaved(true)
                    }}
                  >
                    <Icons.Star
                      size={22}
                      color={star <= rating ? '#F5C542' : 'rgba(255,255,255,0.35)'}
                      fill={star <= rating ? '#F5C542' : 'transparent'}
                    />
                  </Button>
                ))}
              </XStack>
            ) : null}
          </YStack>
        ) : null}

        {/* Actions */}
        <YStack width="100%" gap="$3" paddingTop="$1">
          <Button
            tone="primary"
            size="$5"
            borderRadius={12}
            width="100%"
            icon={<Icons.Plus size={18} color="#fff" />}
            onPress={() => router.push(coWorkRoutes.home as never)}
            style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
          >
            <Text fontSize={15} fontWeight="700" color="#fff">
              Start a New Meeting
            </Text>
          </Button>

          {hasRecording ? (
            <Button
              tone="outline"
              size="$5"
              borderRadius={12}
              width="100%"
              borderColor="rgba(216, 27, 96, 0.35)"
              backgroundColor="rgba(216, 27, 96, 0.06)"
              icon={<Icons.Video size={16} color={coworkUi.brandLight} />}
              onPress={() => router.push(coWorkRoutes.home as never)}
            >
              <Text fontSize={15} fontWeight="600" color={coworkUi.brandLight}>
                View Recording
              </Text>
            </Button>
          ) : null}

          <Button
            tone="outline"
            size="$5"
            borderRadius={12}
            width="100%"
            borderColor="rgba(255, 255, 255, 0.14)"
            backgroundColor="rgba(255, 255, 255, 0.04)"
            onPress={onDone}
          >
            <Text fontSize={15} fontWeight="600" color="#ffffff">
              Return to Home
            </Text>
          </Button>
        </YStack>
      </YStack>
    </ScreenFill>
  )
}
