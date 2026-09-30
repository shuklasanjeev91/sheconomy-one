import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingSpeakingWhileMutedBannerProps = {
  visible: boolean
  topOffset?: number
  /** Zoom-style Unmute CTA — when provided, the banner becomes interactive. */
  onUnmute?: () => void
}

/** Soft banner when the local mic is off but audio input is active. */
export function MeetingSpeakingWhileMutedBanner({
  visible,
  topOffset = 96,
  onUnmute,
}: MeetingSpeakingWhileMutedBannerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  if (!visible) return null

  return (
    <YStack
      position="absolute"
      top={topOffset}
      alignSelf="center"
      zIndex={48}
      maxWidth="92%"
      pointerEvents={onUnmute ? 'box-none' : 'none'}
    >
      <XStack
        alignItems="center"
        gap="$2.5"
        paddingHorizontal="$3.5"
        paddingVertical="$2.5"
        borderRadius={14}
        backgroundColor={coworkUi.glassElevated}
        borderWidth={1}
        borderColor="rgba(245,197,66,0.45)"
      >
        <Text fontSize={14}>🔇</Text>
        <YStack gap={1} flexShrink={1}>
          <Text color={coworkUi.text} fontSize={13} fontWeight="800">
            You’re muted
          </Text>
          <Text color={coworkUi.textSecondary} fontSize={11} lineHeight={15}>
            Unmute to be heard by others
          </Text>
        </YStack>
        {onUnmute ? (
          <Pressable
            onPress={onUnmute}
            accessibilityRole="button"
            accessibilityLabel="Unmute microphone"
            style={{
              marginLeft: 4,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: 'rgba(245,197,66,0.22)',
              borderWidth: 1,
              borderColor: 'rgba(245,197,66,0.55)',
            }}
          >
            <Text color={coworkUi.warning} fontSize={12} fontWeight="800">
              Unmute
            </Text>
          </Pressable>
        ) : null}
      </XStack>
    </YStack>
  )
}
