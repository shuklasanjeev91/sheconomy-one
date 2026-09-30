import { useMemo, useRef } from 'react'
import { PanResponder, useWindowDimensions } from 'react-native'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { meetingStageIsHorizontalDrag, meetingStageSwipeDirection } from '~/co-work/lib/meeting-stage-pager'

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
  /** Back to the active speaker page (swipe left or the second dot). */
  onExitMode: () => void
  /** Third stage page; omitted when there is no gallery (alone in the room). */
  onOpenGallery?: () => void
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
  onOpenGallery,
}: MeetingSafeDrivingModeProps) {
  const { ui } = useCoWorkTheme()
  const { width } = useWindowDimensions()
  const latest = useRef({ onExitMode, width })
  latest.current = { onExitMode, width }
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          meetingStageIsHorizontalDrag(gesture.dx, gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const direction = meetingStageSwipeDirection({
            dx: gesture.dx,
            dy: gesture.dy,
            vx: gesture.vx,
            width: latest.current.width,
          })
          if (direction === 'next') latest.current.onExitMode()
        },
      }),
    [],
  )
  if (!open) return null

  return (
    <YStack
      {...panResponder.panHandlers}
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={120}
      backgroundColor={ui.pageBg}
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
          <Icons.Volume2 size={24} color={ui.text} />
        </Pressable>
        <Text color={ui.text} fontSize={19} fontWeight="800">
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
        <Text color={ui.text} fontSize={15} fontWeight="500" textAlign="center">
          {speaking ? 'You are speaking' : 'Your microphone is muted'}
        </Text>
        <Text color={ui.text} fontSize={15} fontWeight="500" textAlign="center">
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
            borderColor: speaking || pressed ? '#D81B60' : ui.text,
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

      {/* Stage pages: Tap to speak · Active speaker · Gallery */}
      <XStack
        alignItems="center"
        justifyContent="center"
        gap="$2.5"
        paddingBottom="$2"
      >
        <Pressable
          hitSlop={8}
          accessibilityLabel="Tap to speak"
          accessibilityState={{ selected: true }}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: ui.text,
          }}
        />
        <Pressable
          onPress={onExitMode}
          hitSlop={8}
          accessibilityLabel="Active speaker"
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: ui.textMuted,
          }}
        />
        {onOpenGallery ? (
          <Pressable
            onPress={onOpenGallery}
            hitSlop={8}
            accessibilityLabel="Gallery"
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: ui.textMuted,
            }}
          />
        ) : null}
      </XStack>
    </YStack>
  )
}
