import { Text, XStack, YStack } from '~/components/ui'
import { formatCaptionTimestamp, type LiveCaptionLine } from '~/co-work/lib/live-captions'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { isWebRuntime } from '~/lib/platform/capabilities'

type MeetingLiveCaptionsProps = {
  active: boolean
  currentCaption: string
  lines: LiveCaptionLine[]
  error?: string | null
}

export function MeetingLiveCaptions({ active, currentCaption, lines, error }: MeetingLiveCaptionsProps) {
  const { ui: coworkUi } = useCoWorkTheme()

  if (!active && !error) return null

  const recent = lines.filter((line) => line.isFinal).slice(-2)

  return (
    <YStack
      position={isWebRuntime() ? ('fixed' as const) : ('absolute' as const)}
      left={12}
      right={12}
      bottom={112}
      zIndex={28}
      pointerEvents="none"
      alignItems="center"
      gap="$2"
    >
      {error ? (
        <YStack
          maxWidth={720}
          width="100%"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={coworkUi.radius.card}
          backgroundColor={coworkUi.warningMuted}
          borderWidth={1}
          borderColor="rgba(251,191,36,0.35)"
        >
          <Text fontSize={12} color={coworkUi.warning} textAlign="center">
            {error}
          </Text>
        </YStack>
      ) : null}

      {active && currentCaption ? (
        <YStack
          maxWidth={820}
          width="100%"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={coworkGlassStyle(coworkUi, true)}
          gap="$2"
        >
          <XStack alignItems="center" gap="$2">
            <YStack width={8} height={8} borderRadius={999} backgroundColor={coworkUi.live} />
            <Text fontSize={10} fontWeight="800" color={coworkUi.brandLight} letterSpacing={1}>
              LIVE CAPTIONS
            </Text>
          </XStack>
          <Text fontSize={16} fontWeight="700" color={coworkUi.text} lineHeight={24}>
            {currentCaption}
          </Text>
          {recent.length > 1 ? (
            <YStack gap={4} opacity={0.72}>
              {recent.slice(0, -1).map((line) => (
                <Text key={line.id} fontSize={12} color={coworkUi.textSecondary} lineHeight={18}>
                  {line.speaker}: {line.text}
                </Text>
              ))}
            </YStack>
          ) : null}
        </YStack>
      ) : active ? (
        <YStack
          maxWidth={520}
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={999}
          backgroundColor={coworkUi.chipBg}
          borderWidth={1}
          borderColor={coworkUi.borderAccent}
        >
          <Text fontSize={12} color={coworkUi.textMuted}>
            Listening for speech…
          </Text>
        </YStack>
      ) : null}

      {active && lines.length > 0 ? (
        <Text fontSize={10} color={coworkUi.textMuted}>
          Last update {formatCaptionTimestamp(lines[lines.length - 1]?.timestamp ?? Date.now())}
        </Text>
      ) : null}
    </YStack>
  )
}
