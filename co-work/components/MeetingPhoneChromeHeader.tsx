import { Pressable } from 'react-native'
import type { ReactNode } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'

type MeetingPhoneChromeHeaderProps = {
  safeTop: number
  safeLeft: number
  safeRight: number
  title: string
  recording?: boolean
  speakerOn?: boolean
  onMinimize: () => void
  onMeetingInfo: () => void
  onEffects?: () => void
  onToggleSpeaker?: () => void
  onFlipCamera?: () => void
}

function HeaderIconButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress?: () => void
  children: ReactNode
}) {
  if (!onPress) return null
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.14)' : 'transparent',
      })}
    >
      {children}
    </Pressable>
  )
}

/**
 * Zoom phone meeting header — minimize · title chevron · effects / speaker / flip.
 */
export function MeetingPhoneChromeHeader({
  safeTop,
  safeLeft,
  safeRight,
  title,
  recording = false,
  speakerOn = true,
  onMinimize,
  onMeetingInfo,
  onEffects,
  onToggleSpeaker,
  onFlipCamera,
}: MeetingPhoneChromeHeaderProps) {
  return (
    <XStack
      paddingLeft={Math.max(safeLeft, 10)}
      paddingRight={Math.max(safeRight, 10)}
      paddingTop={safeTop > 0 ? safeTop : 8}
      paddingBottom={8}
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      style={{
        backgroundColor: 'rgba(8, 6, 8, 0.72)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <XStack alignItems="center" minWidth={40}>
        <HeaderIconButton label="Minimize meeting" onPress={onMinimize}>
          <Icons.Minimize2 size={18} color="#fff" />
        </HeaderIconButton>
      </XStack>

      <Pressable
        onPress={onMeetingInfo}
        accessibilityRole="button"
        accessibilityLabel="Meeting info"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          minWidth: 0,
          paddingHorizontal: 8,
        }}
      >
        <Text
          fontSize={14}
          fontWeight="700"
          color="#fff"
          numberOfLines={1}
          letterSpacing={-0.2}
          flexShrink={1}
          maxWidth="82%"
        >
          {title}
        </Text>
        {recording ? (
          <YStack width={6} height={6} borderRadius={999} backgroundColor="#E02828" flexShrink={0} />
        ) : null}
        <Icons.ChevronDown size={14} color="#fff" />
      </Pressable>

      <XStack alignItems="center" gap={2} minWidth={40} justifyContent="flex-end">
        <HeaderIconButton label="Effects and backgrounds" onPress={onEffects}>
          <Icons.Sparkles size={16} color="#fff" />
        </HeaderIconButton>
        <HeaderIconButton label="Audio output" onPress={onToggleSpeaker}>
          {speakerOn ? (
            <Icons.Volume2 size={16} color="#fff" />
          ) : (
            <Icons.VolumeX size={16} color="#fff" />
          )}
        </HeaderIconButton>
        <HeaderIconButton label="Flip camera" onPress={onFlipCamera}>
          <Icons.RefreshCw size={15} color="#fff" />
        </HeaderIconButton>
      </XStack>
    </XStack>
  )
}
