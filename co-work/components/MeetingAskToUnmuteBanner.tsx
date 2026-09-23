import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingAskToUnmuteBannerProps = {
  visible: boolean
  topOffset?: number
  onUnmute?: () => void
  onDismiss?: () => void
}

/** Zoom-style banner when a host asks you to unmute. */
export function MeetingAskToUnmuteBanner({
  visible,
  topOffset = 96,
  onUnmute,
  onDismiss,
}: MeetingAskToUnmuteBannerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  if (!visible) return null

  return (
    <YStack
      position="absolute"
      top={topOffset}
      alignSelf="center"
      zIndex={49}
      maxWidth="92%"
      pointerEvents="box-none"
    >
      <XStack
        alignItems="center"
        gap="$2.5"
        paddingHorizontal="$3.5"
        paddingVertical="$2.5"
        borderRadius={14}
        backgroundColor="rgba(20,15,18,0.94)"
        borderWidth={1}
        borderColor="rgba(125, 211, 252, 0.45)"
      >
        <Text fontSize={14}>🎙️</Text>
        <YStack gap={1} flexShrink={1}>
          <Text color="#fff" fontSize={13} fontWeight="800">
            Host asked you to unmute
          </Text>
          <Text color={coworkUi.textSecondary} fontSize={11} lineHeight={15}>
            Turn on your mic when you’re ready
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
              backgroundColor: 'rgba(125, 211, 252, 0.22)',
              borderWidth: 1,
              borderColor: 'rgba(125, 211, 252, 0.55)',
            }}
          >
            <Text color="#7DD3FC" fontSize={12} fontWeight="800">
              Unmute
            </Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={{ paddingHorizontal: 6, paddingVertical: 8 }}
          >
            <Text color={coworkUi.textMuted} fontSize={12} fontWeight="700">
              ✕
            </Text>
          </Pressable>
        ) : null}
      </XStack>
    </YStack>
  )
}
