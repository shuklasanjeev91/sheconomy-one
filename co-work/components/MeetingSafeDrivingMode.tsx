import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

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
 * Zoom-style Safe driving mode — large push-to-talk, video stopped, Sheconomy layout.
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
      backgroundColor="#000000"
      paddingHorizontal="$5"
      paddingTop="$6"
      paddingBottom="$6"
      justifyContent="space-between"
    >
      {/* Header Bar (Image 4: Speaker · Safe driving mode · End) */}
      <XStack alignItems="center" justifyContent="space-between" paddingTop={8}>
        <Pressable
          onPress={onToggleSpeaker}
          accessibilityLabel="Audio output"
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.Volume2 size={24} color="#fff" />
        </Pressable>
        <Text color="#fff" fontSize={19} fontWeight="800">
          Safe driving mode
        </Text>
        <Pressable
          onPress={onEnd}
          accessibilityRole="button"
          accessibilityLabel="End meeting"
          style={({ pressed }) => ({
            height: 32,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: pressed ? '#DC2626' : '#EF4444',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text color="#fff" fontSize={13} fontWeight="700">
            End
          </Text>
        </Pressable>
      </XStack>

      {/* Subtitles (Image 4) */}
      <YStack alignItems="center" gap="$1" marginTop="$4">
        <Text color="#FFFFFF" fontSize={15} fontWeight="500" textAlign="center">
          {speaking ? 'You are speaking' : 'Your microphone is muted'}
        </Text>
        <Text color="#FFFFFF" fontSize={15} fontWeight="500" textAlign="center">
          Your video is stopped
        </Text>
      </YStack>

      {/* Center Push-To-Talk Button (Image 4: Large white circle + blue text) */}
      <YStack alignItems="center" justifyContent="center" flex={1}>
        <Pressable
          onPressIn={onHoldSpeak}
          onPressOut={onReleaseSpeak}
          accessibilityRole="button"
          accessibilityLabel="Tap and hold to speak"
          style={({ pressed }) => ({
            width: 220,
            height: 220,
            borderRadius: 110,
            borderWidth: 2.5,
            borderColor: speaking || pressed ? '#D81B60' : '#FFFFFF',
            backgroundColor: speaking || pressed ? 'rgba(216, 27, 96, 0.18)' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text
            color={speaking ? '#FF5E9B' : '#D81B60'}
            fontSize={23}
            fontWeight="600"
            letterSpacing={-0.3}
          >
            {speaking ? 'Speaking…' : 'Tap to speak'}
          </Text>
        </Pressable>
      </YStack>

      {/* Bottom Pagination Dots (Image 4: ● ○ - tap right to return to video room) */}
      <XStack
        alignItems="center"
        justifyContent="center"
        gap="$2.5"
        paddingBottom="$2"
      >
        <Pressable
          hitSlop={8}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: '#FFFFFF',
          }}
        />
        <Pressable
          onPress={onExitMode}
          hitSlop={8}
          accessibilityLabel="Back to meeting video"
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
          }}
        />
      </XStack>
    </YStack>
  )
}
