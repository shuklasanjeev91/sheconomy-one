import { Pressable } from 'react-native'
import type { ReactNode } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingIpadChromeHeaderProps = {
  safeTop: number
  safeLeft: number
  safeRight: number
  locked?: boolean
  recording?: boolean
  viewMode: 'gallery' | 'speaker' | 'screen-share' | string
  speakerOn?: boolean
  onBack: () => void
  onMeetingInfo: () => void
  onAnnotate?: () => void
  onToggleSpeaker?: () => void
  onFlipCamera?: () => void
  onSettings?: () => void
  onSecurity?: () => void
  onToggleView?: () => void
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
        width: 36,
        height: 36,
        borderRadius: 10,
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
 * Zoom iPad landscape header — translucent strip with back · brand pill · tools.
 */
export function MeetingIpadChromeHeader({
  safeTop,
  safeLeft,
  safeRight,
  locked = false,
  recording = false,
  viewMode,
  speakerOn = true,
  onBack,
  onMeetingInfo,
  onAnnotate,
  onToggleSpeaker,
  onFlipCamera,
  onSettings,
  onSecurity,
  onToggleView,
}: MeetingIpadChromeHeaderProps) {
  const { ui } = useCoWorkTheme()

  return (
    <XStack
      paddingLeft={Math.max(safeLeft, 14)}
      paddingRight={Math.max(safeRight, 14)}
      paddingTop={safeTop > 0 ? safeTop : 8}
      paddingBottom={8}
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      style={{
        backgroundColor: 'rgba(8, 6, 8, 0.55)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <XStack alignItems="center" gap="$1" minWidth={88}>
        <HeaderIconButton label="Minimize meeting" onPress={onBack}>
          <Icons.Minimize2 size={20} color="#fff" />
        </HeaderIconButton>
        <HeaderIconButton label="Meeting information" onPress={onMeetingInfo}>
          <Icons.Info size={18} color="#fff" />
        </HeaderIconButton>
      </XStack>

      <Pressable
        onPress={onMeetingInfo}
        accessibilityRole="button"
        accessibilityLabel="Meeting info"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: 'rgba(34, 197, 94, 0.16)',
          borderWidth: 1,
          borderColor: 'rgba(34, 197, 94, 0.4)',
        }}
      >
        <Icons.ShieldCheck size={14} color="#22C55E" />
        <Text fontSize={13} fontWeight="800" color="#F0FFF4" letterSpacing={-0.2}>
          Sheconomy
        </Text>
        {locked ? <Icons.Lock size={12} color="#FCD34D" /> : null}
        {recording ? (
          <YStack width={6} height={6} borderRadius={999} backgroundColor={ui.danger} />
        ) : null}
        <Icons.ChevronDown size={13} color="#F0FFF4" />
      </Pressable>

      <XStack alignItems="center" gap={2} minWidth={88} justifyContent="flex-end">
        <HeaderIconButton label="Annotate" onPress={onAnnotate}>
          <Icons.Pencil size={17} color="#fff" />
        </HeaderIconButton>
        <HeaderIconButton label="Audio output" onPress={onToggleSpeaker}>
          {speakerOn ? (
            <Icons.Volume2 size={17} color="#fff" />
          ) : (
            <Icons.VolumeX size={17} color="#fff" />
          )}
        </HeaderIconButton>
        <HeaderIconButton label="Flip camera" onPress={onFlipCamera}>
          <Icons.RefreshCw size={16} color="#fff" />
        </HeaderIconButton>
        <HeaderIconButton label="Meeting settings" onPress={onSettings}>
          <Icons.Settings size={17} color="#fff" />
        </HeaderIconButton>
        <HeaderIconButton label="Security" onPress={onSecurity}>
          <Icons.Shield size={17} color={locked ? '#FCD34D' : '#22C55E'} />
        </HeaderIconButton>
        <HeaderIconButton
          label={viewMode === 'speaker' ? 'Gallery view' : 'Speaker view'}
          onPress={onToggleView}
        >
          <Icons.LayoutGrid size={17} color="#fff" />
        </HeaderIconButton>
      </XStack>
    </XStack>
  )
}
