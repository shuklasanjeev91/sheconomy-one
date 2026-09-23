import type { ReactNode } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'

export type MeetingHeaderProps = {
  safeTop: number
  safeLeft: number
  safeRight: number
  title?: string
  /** Narrow phone-width layout. False for tablet / desktop web. */
  compact?: boolean
  locked?: boolean
  recording?: boolean
  viewMode?: 'gallery' | 'speaker' | 'screen-share' | string
  speakerOn?: boolean
  onBack?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
  onToggleFullscreen?: () => void
  fullscreenActive?: boolean
  onMeetingInfo: () => void
  onTile?: () => void
  onAnnotate?: () => void
  onWhiteboard?: () => void
  onEffects?: () => void
  onToggleSpeaker?: () => void
  onFlipCamera?: () => void
  onSettings?: () => void
  onSecurity?: () => void
  onToggleView?: () => void
  onEnd?: () => void
  isHost?: boolean
}

/**
 * Use Tamagui stacks for press targets — not RN `Pressable`.
 * Production Hermes + vxrn `__toESM(require_react_native(), 1)` drops RN named
 * exports so `import_react_native.Pressable` throws:
 *   Property 'Pressable' doesn't exist
 */
function HeaderIconButton({
  label,
  onPress,
  children,
  round = false,
}: {
  label: string
  onPress?: () => void
  children: ReactNode
  round?: boolean
}) {
  if (!onPress) return null
  return (
    <XStack
      onPress={onPress}
      role="button"
      aria-label={label}
      width={36}
      height={36}
      borderRadius={round ? 999 : 10}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
      cursor="pointer"
      hitSlop={8}
    >
      {children}
    </XStack>
  )
}

/**
 * One meeting header for web, Android, and iOS.
 * Layout follows viewport width (`compact`), not OS — no phone/tablet/web file splits.
 */
export function MeetingHeader({
  safeTop,
  safeLeft,
  safeRight,
  title,
  compact = false,
  locked = false,
  recording = false,
  viewMode = 'gallery',
  speakerOn = true,
  onBack,
  onMinimize,
  onMaximize,
  onToggleFullscreen,
  fullscreenActive = false,
  onMeetingInfo,
  onTile,
  onAnnotate,
  onWhiteboard,
  onEffects,
  onToggleSpeaker,
  onFlipCamera,
  onSettings,
  onSecurity,
  onToggleView,
  onEnd,
  isHost = false,
}: MeetingHeaderProps) {
  // Compact: phone-width (web or native)
  if (compact) {
    return (
      <XStack
        paddingLeft={Math.max(safeLeft, 10)}
        paddingRight={Math.max(safeRight, 10)}
        paddingTop={Math.max(safeTop, 8) + 4}
        paddingBottom={8}
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        style={{
          backgroundColor: 'rgba(24, 13, 20, 0.92)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <XStack alignItems="center" gap="$1" minWidth={40}>
          <HeaderIconButton label="Minimize meeting" onPress={onMinimize || onBack} round>
            <Icons.Minimize2 size={20} color="#fff" />
          </HeaderIconButton>
        </XStack>

        <XStack
          onPress={onMeetingInfo}
          role="button"
          aria-label="Meeting info"
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap={6}
          minWidth={0}
          paddingHorizontal={8}
          pressStyle={{ opacity: 0.75 }}
          cursor="pointer"
        >
          <Text
            fontSize={15}
            fontWeight="700"
            color="#fff"
            numberOfLines={1}
            letterSpacing={-0.2}
            flexShrink={1}
            maxWidth="82%"
          >
            {title || 'Meeting'}
          </Text>
          {recording ? (
            <YStack width={6} height={6} borderRadius={999} backgroundColor="#E02828" flexShrink={0} />
          ) : null}
          <Icons.ChevronDown size={14} color="#fff" />
        </XStack>

        <XStack alignItems="center" gap={3} minWidth={40} justifyContent="flex-end">
          {onWhiteboard || onAnnotate ? (
            <HeaderIconButton
              label="Whiteboard and annotate"
              onPress={onWhiteboard || onAnnotate}
              round
            >
              <Icons.Edit3 size={19} color="#fff" />
            </HeaderIconButton>
          ) : null}

          {onToggleSpeaker ? (
            <HeaderIconButton
              label={speakerOn ? 'Switch to earpiece' : 'Switch to speakerphone'}
              onPress={onToggleSpeaker}
              round
            >
              {speakerOn ? (
                <Icons.Volume2 size={20} color="#fff" />
              ) : (
                <Icons.VolumeX size={20} color="rgba(255,255,255,0.7)" />
              )}
            </HeaderIconButton>
          ) : null}

          {onFlipCamera ? (
            <HeaderIconButton label="Switch camera" onPress={onFlipCamera} round>
              <Icons.RefreshCw size={19} color="#fff" />
            </HeaderIconButton>
          ) : null}
        </XStack>
      </XStack>
    )
  }

  // Roomy: tablet / desktop (web or native)
  return (
    <XStack
      paddingLeft={Math.max(safeLeft, 12)}
      paddingRight={Math.max(safeRight, 12)}
      paddingTop={Math.max(safeTop, 10) + 4}
      paddingBottom={10}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      style={{
        backgroundColor: 'rgba(24, 13, 20, 0.92)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <XStack alignItems="center" gap="$2">
        {onBack || onMinimize ? (
          <HeaderIconButton label="Minimize meeting" onPress={onMinimize || onBack}>
            <Icons.ChevronLeft size={22} color="#fff" />
          </HeaderIconButton>
        ) : null}

        <XStack
          onPress={onMeetingInfo}
          role="button"
          aria-label="Meeting info and encryption"
          alignItems="center"
          gap={8}
          paddingHorizontal={12}
          paddingVertical={6}
          borderRadius={8}
          backgroundColor="rgba(255,255,255,0.06)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.1)"
          pressStyle={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          cursor="pointer"
        >
          {locked ? (
            <Icons.Lock size={14} color="#F59E0B" />
          ) : (
            <Icons.ShieldCheck size={16} color="#22C55E" />
          )}
          <Text fontSize={14} fontWeight="700" color="#fff">
            {title || 'Sheconomy Meeting'}
          </Text>
          <Icons.ChevronDown size={14} color="rgba(255,255,255,0.6)" />
        </XStack>

        {recording ? (
          <XStack
            alignItems="center"
            gap={6}
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor="rgba(224, 40, 40, 0.2)"
            borderWidth={1}
            borderColor="rgba(224, 40, 40, 0.4)"
          >
            <YStack width={8} height={8} borderRadius={999} backgroundColor="#E02828" />
            <Text color="#fff" fontSize={11} fontWeight="700">
              REC
            </Text>
          </XStack>
        ) : null}
      </XStack>

      <XStack alignItems="center" gap="$1.5">
        {onToggleView ? (
          <HeaderIconButton
            label={viewMode === 'speaker' ? 'Switch to gallery' : 'Switch to speaker'}
            onPress={onToggleView}
          >
            {viewMode === 'speaker' ? (
              <Icons.Grid2x2 size={18} color="#fff" />
            ) : (
              <Icons.User size={18} color="#fff" />
            )}
          </HeaderIconButton>
        ) : null}

        {onTile ? (
          <HeaderIconButton label="Picture in Picture" onPress={onTile}>
            <Icons.Layers size={18} color="#fff" />
          </HeaderIconButton>
        ) : null}

        {onAnnotate || onWhiteboard ? (
          <HeaderIconButton label="Whiteboard / Annotate" onPress={onAnnotate || onWhiteboard}>
            <Icons.Edit3 size={18} color="#fff" />
          </HeaderIconButton>
        ) : null}

        {onToggleSpeaker ? (
          <HeaderIconButton
            label={speakerOn ? 'Loudspeaker on' : 'Earpiece mode'}
            onPress={onToggleSpeaker}
          >
            {speakerOn ? (
              <Icons.Volume2 size={19} color="#fff" />
            ) : (
              <Icons.VolumeX size={19} color="rgba(255,255,255,0.7)" />
            )}
          </HeaderIconButton>
        ) : null}

        {onFlipCamera ? (
          <HeaderIconButton label="Flip camera" onPress={onFlipCamera}>
            <Icons.RefreshCw size={18} color="#fff" />
          </HeaderIconButton>
        ) : null}

        {onToggleFullscreen || onMaximize ? (
          <HeaderIconButton
            label={fullscreenActive ? 'Exit full screen' : 'Full screen'}
            onPress={onToggleFullscreen || onMaximize}
          >
            {fullscreenActive ? (
              <Icons.Minimize2 size={18} color="#fff" />
            ) : (
              <Icons.Maximize2 size={18} color="#fff" />
            )}
          </HeaderIconButton>
        ) : null}

        {onSecurity ? (
          <HeaderIconButton label="Security" onPress={onSecurity}>
            <Icons.Shield size={18} color="#fff" />
          </HeaderIconButton>
        ) : null}

        {onSettings ? (
          <HeaderIconButton label="Settings" onPress={onSettings}>
            <Icons.Settings size={18} color="#fff" />
          </HeaderIconButton>
        ) : null}

        {onEnd ? (
          <XStack
            onPress={onEnd}
            role="button"
            aria-label={isHost ? 'End meeting' : 'Leave meeting'}
            paddingHorizontal={14}
            paddingVertical={7}
            borderRadius={8}
            backgroundColor="#dc2626"
            marginLeft={6}
            pressStyle={{ backgroundColor: '#b91c1c' }}
            cursor="pointer"
          >
            <Text color="#fff" fontSize={13} fontWeight="700">
              {isHost ? 'End' : 'Leave'}
            </Text>
          </XStack>
        ) : null}
      </XStack>
    </XStack>
  )
}
