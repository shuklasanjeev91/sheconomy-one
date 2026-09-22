import { Pressable } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingSafeDrivingModeProps = {
  open: boolean
  muted: boolean
  videoOff: boolean
  speaking: boolean
  onHoldSpeak: () => void
  onReleaseSpeak: () => void
  onToggleSpeaker?: () => void
  onEnd: () => void
  onExitMode: () => void
}

/**
 * Zoom-style Safe driving mode — large push-to-talk, video stopped, Sheconomy chrome.
 */
export function MeetingSafeDrivingMode({
  open,
  muted,
  videoOff,
  speaking,
  onHoldSpeak,
  onReleaseSpeak,
  onToggleSpeaker,
  onEnd,
  onExitMode,
}: MeetingSafeDrivingModeProps) {
  const { ui } = useCoWorkTheme()
  if (!open) return null

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={120}
      backgroundColor="#10070D"
      paddingHorizontal="$5"
      paddingTop="$6"
      paddingBottom="$8"
      justifyContent="space-between"
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Pressable
          onPress={onToggleSpeaker}
          accessibilityLabel="Audio output"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.Volume2 size={20} color="#fff" />
        </Pressable>
        <Text color="#fff" fontSize={16} fontWeight="800">
          Safe driving mode
        </Text>
        <Button
          tone="primary"
          size="$2"
          height={32}
          paddingHorizontal="$3"
          borderRadius={8}
          backgroundColor={ui.danger}
          onPress={onEnd}
        >
          End
        </Button>
      </XStack>

      <YStack alignItems="center" gap="$2">
        <Text color={ui.textSecondary} fontSize={14} fontWeight="600">
          {muted && !speaking ? 'Your microphone is muted' : speaking ? 'You’re speaking' : 'Microphone ready'}
        </Text>
        <Text color={ui.textMuted} fontSize={13}>
          {videoOff ? 'Your video is stopped.' : 'Video will turn off in this mode.'}
        </Text>
      </YStack>

      <YStack alignItems="center" justifyContent="center" flex={1}>
        <Pressable
          onPressIn={onHoldSpeak}
          onPressOut={onReleaseSpeak}
          accessibilityRole="button"
          accessibilityLabel="Tap and hold to speak"
          style={{
            width: 220,
            height: 220,
            borderRadius: 999,
            borderWidth: 3,
            borderColor: speaking ? ui.brandLight : 'rgba(255,255,255,0.55)',
            backgroundColor: speaking ? 'rgba(216, 27, 96, 0.18)' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            color={speaking ? ui.brandLight : ui.brandLight}
            fontSize={20}
            fontWeight="800"
            letterSpacing={-0.3}
          >
            {speaking ? 'Speaking…' : 'Tap to speak'}
          </Text>
        </Pressable>
      </YStack>

      <Button tone="outline" borderRadius={12} height={44} onPress={onExitMode}>
        Exit safe driving mode
      </Button>
    </YStack>
  )
}
