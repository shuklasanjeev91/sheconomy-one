import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { ViewportOverlay } from '~/components/layout'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingReactionTray } from '~/co-work/components/MeetingReactionTray'
import { useAppLayout } from '~/hooks/useAppLayout'
import { meetingChatToolbarLabel } from '~/co-work/lib/meeting-chat'
import {
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarMoreSections,
  meetingToolbarPrimaryKeys,
  meetingToolbarSecurityKeys,
  type MeetingToolbarOverflowKey,
  type MeetingToolbarPrimaryKey,
} from '~/co-work/lib/meeting-toolbar'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow } from '~/lib/platform/crossStyles'
import type { MediaCapabilities, MeetingRole } from '~/co-work/lib/types'

type MeetingControlsProps = {
  caps: MediaCapabilities
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  /** True when local or remote screen share is on stage. */
  hasActiveScreenShare?: boolean
  handRaised: boolean
  recording: boolean
  captionsActive: boolean
  isHost: boolean
  viewerRole?: MeetingRole
  canModerate?: boolean
  /** Lock / mute-all / remove-all — host only. */
  canChangeCriticalSettings?: boolean
  isLocked?: boolean
  panel: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio' | 'host_tools'
  backgroundActive?: boolean
  unreadChatCount?: number
  raisedHandCount?: number
  reactionTrayOpen?: boolean
  busy?: boolean
  viewMode?: MeetingViewMode
  mirrorLocalVideo?: boolean
  hideSelfView?: boolean
  uiMaximized?: boolean
  onSetViewMode?: (viewMode: MeetingViewMode) => void
  onToggleMirror?: () => void
  onToggleHideSelfView?: () => void
  onToggleMaximize?: () => void
  onToggleAudio: () => void
  onOpenAudioSettings?: () => void
  onToggleVideo: () => void
  onToggleBackgrounds?: () => void
  onToggleScreen: () => void
  onToggleHand: () => void
  onToggleReactions?: () => void
  onSendReaction?: (emoji: string) => void
  onToggleRecord: () => void
  onToggleCaptions: () => void
  onToggleChat: () => void
  onTogglePeople: () => void
  onToggleInfo: () => void
  onToggleInvite?: () => void
  onToggleHostTools?: () => void
  onShare?: () => void
  onLeave: () => void
  onEnd: () => void
  onMuteAll?: () => void
  onAskAllToMute?: () => void
  onAskAllToUnmute?: () => void
  onRemoveAllExceptHost?: () => void
  onToggleLock?: () => void
  /** Web Fullscreen API — omit on native. */
  onToggleFullscreen?: () => void
  fullscreenActive?: boolean
  /** Shrink to app-wide mini-player while browsing other tabs. */
  onMinimize?: () => void
  /** OS Picture-in-Picture where supported. */
  onPictureInPicture?: () => void
  /** Orientation policy can force compact dock (e.g. landscape phone). */
  forceCompact?: boolean
}

type ControlVariant = 'neutral' | 'brand' | 'danger' | 'off'
type FlyoutKind = 'none' | 'more' | 'security'

/**
 * Overflow menu that stays inside the viewport.
 * On web we use `position: fixed` so InstantMeetingHost / footer overflow cannot
 * clip the panel (the "options showing out of box" bug).
 */
type FlyoutPos = {
  bottom: number
  left?: number
  right?: number
  maxHeight: number
}

function MeetingFlyoutPanel({
  open,
  width,
  maxHeight,
  align,
  children,
}: {
  open: boolean
  width: number
  maxHeight: number
  align: 'left' | 'right'
  children: ReactNode
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [pos, setPos] = useState<FlyoutPos | null>(null)

  const bindAnchor = useCallback((node: unknown) => {
    if (Platform.OS !== 'web') {
      setAnchorEl(null)
      return
    }
    // Tamagui may hand back a host object or the DOM node directly.
    const candidate = node as { getBoundingClientRect?: () => DOMRect; host?: HTMLElement } | HTMLElement | null
    let next: HTMLElement | null = null
    if (candidate && typeof (candidate as HTMLElement).getBoundingClientRect === 'function') {
      next = candidate as HTMLElement
    } else {
      const host = candidate?.host
      next = host && typeof host.getBoundingClientRect === 'function' ? host : null
    }
    setAnchorEl((prev) => (prev === next ? prev : next))
  }, [])

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }

    if (Platform.OS !== 'web') return

    const measure = () => {
      if (!anchorEl || typeof window === 'undefined') return
      const rect = anchorEl.getBoundingClientRect()
      if (!rect.width && !rect.height && rect.top === 0 && rect.left === 0) return
      const gap = 10
      const spaceAbove = Math.max(120, Math.round(rect.top - gap - 8))
      const next: FlyoutPos = {
        // Sit just above the trigger (More / Security cluster).
        bottom: Math.max(12, Math.round(window.innerHeight - rect.top + gap)),
        maxHeight: Math.min(maxHeight, spaceAbove),
      }
      if (align === 'right') {
        next.right = Math.max(8, Math.round(window.innerWidth - rect.right))
      } else {
        next.left = Math.max(8, Math.round(rect.left))
      }
      setPos(next)
    }

    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [align, anchorEl, maxHeight, open])

  // Invisible measure target that fills the trigger's relative parent.
  const anchor = (
    <YStack
      ref={bindAnchor as never}
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      opacity={0}
      pointerEvents="none"
    />
  )

  if (!open) return anchor

  const panelMaxHeight = pos?.maxHeight ?? maxHeight
  const panel = (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      bottom={Platform.OS === 'web' && pos ? pos.bottom : '100%'}
      left={
        Platform.OS === 'web' && pos
          ? pos.left
          : align === 'left'
            ? 8
            : undefined
      }
      right={
        Platform.OS === 'web' && pos
          ? pos.right
          : align === 'right'
            ? 0
            : undefined
      }
      marginBottom={Platform.OS === 'web' ? 0 : '$2'}
      width={width}
      maxHeight={panelMaxHeight}
      borderRadius={coworkUi.radius.panel}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      paddingVertical="$2"
      zIndex={MEETING_TOOLBAR_Z_INDEX + 40}
      pointerEvents="auto"
      style={{
        ...meetingBarStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'dock'),
        ...(Platform.OS === 'web' && pos
          ? { position: 'fixed' as const, zIndex: MEETING_TOOLBAR_Z_INDEX + 40 }
          : null),
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: Math.max(120, panelMaxHeight - 12) }}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {children}
      </ScrollView>
    </YStack>
  )

  // Portal on web so InstantMeetingHost `overflow:hidden` cannot clip options.
  if (Platform.OS === 'web') {
    if (!pos) return anchor
    return (
      <>
        {anchor}
        <ViewportOverlay>{panel}</ViewportOverlay>
      </>
    )
  }

  return (
    <>
      {anchor}
      {panel}
    </>
  )
}

function ControlButton({
  label,
  icon: Icon,
  variant,
  onPress,
  compact,
  badgeCount,
}: {
  label: string
  icon: typeof Icons.Mic
  variant: ControlVariant
  onPress: () => void
  compact?: boolean
  badgeCount?: number
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const size = compact ? 40 : 44
  const styles = {
    neutral: {
      bg: coworkUi.meetingControl,
      border: 'transparent',
      icon: coworkUi.text,
      label: coworkUi.meetingIconMuted,
    },
    brand: {
      bg: coworkUi.meetingControlActive,
      border: 'transparent',
      icon: '#fff',
      label: coworkUi.brandLight,
    },
    danger: {
      bg: coworkUi.danger,
      border: 'transparent',
      icon: '#fff',
      label: coworkUi.danger,
    },
    off: {
      bg: coworkUi.dangerMuted,
      border: 'rgba(244,63,104,0.35)',
      icon: coworkUi.danger,
      label: coworkUi.danger,
    },
  }[variant]

  const badge =
    badgeCount && badgeCount > 0 ? (badgeCount > 9 ? '9+' : String(badgeCount)) : null

  return (
    <YStack
      alignItems="center"
      gap={compact ? 0 : 3}
      minWidth={compact ? 44 : Math.max(48, label.length > 8 ? 58 : 48)}
      flexShrink={0}
      maxWidth={compact ? 64 : 72}
    >
      <YStack position="relative">
        <Button
          aria-label={label}
          width={size}
          height={size}
          padding={0}
          borderRadius={coworkUi.radius.control}
          borderWidth={styles.border === 'transparent' ? 0 : 1}
          borderColor={styles.border}
          backgroundColor={styles.bg}
          hoverStyle={{ opacity: 0.92, scale: 1.02 }}
          pressStyle={{ opacity: 0.86, scale: 0.96 }}
          onPress={onPress}
          icon={<Icon size={compact ? 17 : 18} color={styles.icon} />}
        />
        {badge ? (
          <YStack
            position="absolute"
            top={-4}
            right={-4}
            minWidth={18}
            height={18}
            paddingHorizontal={5}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={coworkUi.danger}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.35)"
            zIndex={2}
          >
            <Text fontSize={10} fontWeight="800" color="#fff">
              {badge}
            </Text>
          </YStack>
        ) : null}
      </YStack>
      {!compact ? (
        <Text fontSize={10} fontWeight="600" color={styles.label} textAlign="center" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </YStack>
  )
}

function OverflowItem({
  label,
  icon: Icon,
  active,
  danger,
  disabled,
  onPress,
}: {
  label: string
  icon: typeof Icons.Mic
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const color = danger
    ? coworkUi.danger
    : active
      ? coworkUi.brandLight
      : disabled
        ? coworkUi.meetingIconMuted
        : coworkUi.text
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius={12}
      minHeight={44}
      opacity={disabled ? 0.55 : 1}
      backgroundColor={active && !disabled ? 'rgba(216,27,96,0.12)' : 'transparent'}
      hoverStyle={disabled ? undefined : { backgroundColor: 'rgba(255,255,255,0.07)' }}
      pressStyle={disabled ? undefined : { opacity: 0.8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active && !disabled }}
      onPress={disabled ? undefined : onPress}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <Icon size={17} color={color} />
      <Text fontSize={13} fontWeight="600" color={color} numberOfLines={1}>
        {label}
      </Text>
    </XStack>
  )
}

export function MeetingControls({
  caps,
  audioEnabled,
  videoEnabled,
  backgroundActive = false,
  screenSharing,
  hasActiveScreenShare,
  handRaised,
  recording,
  captionsActive,
  isHost,
  viewerRole,
  canModerate = isHost,
  canChangeCriticalSettings: _canChangeCriticalSettings = isHost,
  isLocked = false,
  panel,
  unreadChatCount = 0,
  raisedHandCount = 0,
  reactionTrayOpen = false,
  busy = false,
  viewMode = 'gallery',
  mirrorLocalVideo = false,
  hideSelfView = false,
  uiMaximized = false,
  onSetViewMode,
  onToggleMirror,
  onToggleHideSelfView,
  onToggleMaximize,
  onToggleAudio,
  onOpenAudioSettings,
  onToggleVideo,
  onToggleBackgrounds,
  onToggleScreen,
  onToggleHand,
  onToggleReactions,
  onSendReaction,
  onToggleRecord,
  onToggleCaptions,
  onToggleChat,
  onTogglePeople,
  onToggleInfo,
  onToggleInvite,
  onToggleHostTools,
  onShare,
  onLeave,
  onEnd,
  onMuteAll,
  onAskAllToMute,
  onAskAllToUnmute,
  onRemoveAllExceptHost,
  onToggleLock,
  onToggleFullscreen,
  fullscreenActive = false,
  onMinimize,
  onPictureInPicture,
  forceCompact,
}: MeetingControlsProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const { isMobile, isTablet, isDesktop } = useAppLayout()
  const { height: windowHeight } = useWindowDimensions()
  const compact = forceCompact || (isMobile && !isTablet && !isDesktop)
  const roomy = !forceCompact && (isTablet || isDesktop)
  const bottomPad = forceCompact ? '$1.5' : '$2'
  const [flyout, setFlyout] = useState<FlyoutKind>('none')
  const flyoutMaxHeight = Math.max(220, Math.min(420, Math.round(windowHeight * 0.55)))
  const flyoutWidth = roomy ? 280 : 248
  const screenShareOnStage = hasActiveScreenShare ?? screenSharing
  const effectiveViewMode: MeetingViewMode =
    viewMode === 'screen-share' && !screenShareOnStage ? 'gallery' : viewMode

  const role: MeetingRole = viewerRole ?? (isHost ? 'host' : canModerate ? 'co_host' : 'participant')
  const hasReactions = !!onToggleReactions
  const hasRaiseHand = true
  const primaryKeys = meetingToolbarPrimaryKeys({
    viewerRole: role,
    supportsVideo: caps.supportsVideo,
    supportsScreenShare: caps.supportsScreenShare,
    supportsLiveCaptions: caps.supportsLiveCaptions,
    hasBrowse: !!onMinimize,
    compact,
    recording,
    hasReactions,
    hasRaiseHand,
  })
  const securityKeys = meetingToolbarSecurityKeys(role)
  const moreSections = meetingToolbarMoreSections({
    viewerRole: role,
    supportsRecording: caps.supportsRecording,
    supportsVideo: caps.supportsVideo,
    hasAudioSettings: !!onOpenAudioSettings,
    hasShareLink: !!onShare,
    hasFullscreen: !!onToggleFullscreen,
    hasMinimize: !!onMinimize,
    hasPictureInPicture: !!onPictureInPicture,
    compact,
    supportsLiveCaptions: caps.supportsLiveCaptions,
    hasInvite: !!(onToggleInvite || onShare),
    hasViewControls: !!(onSetViewMode || onToggleMirror || onToggleMaximize),
    reactionsOnPrimary: hasReactions,
    raiseHandOnPrimary: hasRaiseHand,
    recording,
  })

  const closeFlyout = () => setFlyout('none')
  const runFromFlyout = (action?: () => void) => () => {
    closeFlyout()
    action?.()
  }
  const toggleFlyout = (kind: Exclude<FlyoutKind, 'none'>) => {
    setFlyout((current) => (current === kind ? 'none' : kind))
  }
  const openReactions = () => {
    closeFlyout()
    onToggleReactions?.()
  }

  const overflowLabel = (
    key: MeetingToolbarOverflowKey,
  ): {
    label: string
    icon: typeof Icons.Mic
    active?: boolean
    danger?: boolean
    disabled?: boolean
    onPress: () => void
  } | null => {
    switch (key) {
      case 'view_gallery':
        return onSetViewMode
          ? {
              label: 'Gallery view',
              icon: Icons.LayoutGrid,
              active: effectiveViewMode === 'gallery',
              onPress: runFromFlyout(() => onSetViewMode('gallery')),
            }
          : null
      case 'view_speaker':
        return onSetViewMode
          ? {
              label: 'Speaker view',
              icon: Icons.User,
              active: effectiveViewMode === 'speaker',
              onPress: runFromFlyout(() => onSetViewMode('speaker')),
            }
          : null
      case 'view_screen_share':
        return onSetViewMode
          ? {
              label: 'Screen share view',
              icon: Icons.ScreenShare,
              active: effectiveViewMode === 'screen-share' && screenShareOnStage,
              disabled: !screenShareOnStage,
              onPress: runFromFlyout(() => onSetViewMode('screen-share')),
            }
          : null
      case 'mirror_video':
        return onToggleMirror
          ? {
              label: mirrorLocalVideo ? 'Stop mirroring video' : 'Mirror my video',
              icon: Icons.Video,
              active: mirrorLocalVideo,
              onPress: runFromFlyout(onToggleMirror),
            }
          : null
      case 'hide_self_view':
        return onToggleHideSelfView
          ? {
              label: hideSelfView ? 'Show self view' : 'Hide self view',
              icon: Icons.EyeOff,
              active: hideSelfView,
              onPress: runFromFlyout(onToggleHideSelfView),
            }
          : null
      case 'host_tools':
        return onToggleHostTools
          ? {
              label: 'Host tools',
              icon: Icons.ShieldCheck,
              active: panel === 'host_tools',
              onPress: runFromFlyout(onToggleHostTools),
            }
          : null
      case 'maximize':
        return onToggleMaximize
          ? {
              label: uiMaximized ? 'Exit maximized view' : 'Maximize video',
              icon: uiMaximized ? Icons.Minimize2 : Icons.Maximize2,
              active: uiMaximized,
              onPress: runFromFlyout(onToggleMaximize),
            }
          : null
      case 'captions':
        return {
          label: captionsActive ? 'Hide captions' : 'Captions',
          icon: Icons.Captions,
          active: captionsActive,
          onPress: runFromFlyout(onToggleCaptions),
        }
      case 'invite':
        return {
          label: 'Invite',
          icon: Icons.UserPlus,
          active: panel === 'invite',
          onPress: runFromFlyout(onToggleInvite ?? onShare ?? onToggleInfo),
        }
      case 'audio_settings':
        return onOpenAudioSettings
          ? {
              label: 'Audio settings',
              icon: Icons.SlidersHorizontal,
              active: panel === 'audio',
              onPress: runFromFlyout(onOpenAudioSettings),
            }
          : null
      case 'raise_hand':
        return {
          label: handRaised ? 'Lower hand' : 'Raise hand',
          icon: Icons.Hand,
          active: handRaised,
          onPress: runFromFlyout(onToggleHand),
        }
      case 'reactions':
        return onToggleReactions
          ? {
              label: 'Reactions',
              icon: Icons.Smile,
              active: reactionTrayOpen,
              onPress: runFromFlyout(onToggleReactions),
            }
          : null
      case 'record':
        return caps.supportsRecording
          ? {
              label: recording ? 'Stop recording' : 'Record meeting',
              icon: Icons.Circle,
              active: recording,
              onPress: runFromFlyout(onToggleRecord),
            }
          : null
      case 'background':
        return onToggleBackgrounds
          ? {
              label: 'Background',
              icon: Icons.Sparkles,
              active: panel === 'backgrounds' || backgroundActive,
              onPress: runFromFlyout(onToggleBackgrounds),
            }
          : null
      case 'meeting_info':
        return {
          label: 'Meeting info',
          icon: Icons.Info,
          active: panel === 'info',
          onPress: runFromFlyout(onToggleInfo),
        }
      case 'share_link':
        return onShare
          ? {
              label: 'Share meeting link',
              icon: Icons.Share2,
              onPress: runFromFlyout(onShare),
            }
          : null
      case 'fullscreen':
        return onToggleFullscreen
          ? {
              label: fullscreenActive ? 'Exit full screen' : 'Full screen',
              icon: fullscreenActive ? Icons.Minimize2 : Icons.Maximize2,
              active: fullscreenActive,
              onPress: runFromFlyout(onToggleFullscreen),
            }
          : null
      case 'minimize':
        return onMinimize
          ? {
              label: 'Minimize meeting',
              icon: Icons.Minimize2,
              onPress: runFromFlyout(onMinimize),
            }
          : null
      case 'picture_in_picture':
        return onPictureInPicture
          ? {
              label: 'Picture-in-Picture',
              icon: Icons.Monitor,
              onPress: runFromFlyout(onPictureInPicture),
            }
          : null
      case 'lock_meeting':
        return onToggleLock
          ? {
              label: isLocked ? 'Unlock meeting' : 'Lock meeting',
              icon: isLocked ? Icons.Lock : Icons.Shield,
              active: isLocked,
              onPress: runFromFlyout(onToggleLock),
            }
          : null
      case 'mute_all':
        return onMuteAll
          ? { label: 'Mute all', icon: Icons.MicOff, onPress: runFromFlyout(onMuteAll) }
          : null
      case 'ask_all_to_mute':
        return onAskAllToMute
          ? { label: 'Ask all to mute', icon: Icons.VolumeX, onPress: runFromFlyout(onAskAllToMute) }
          : null
      case 'ask_all_to_unmute':
        return onAskAllToUnmute
          ? { label: 'Ask all to unmute', icon: Icons.Mic, onPress: runFromFlyout(onAskAllToUnmute) }
          : null
      case 'remove_all_except_host':
        return onRemoveAllExceptHost
          ? {
              label: 'Remove all except host',
              icon: Icons.UserX,
              danger: true,
              onPress: runFromFlyout(onRemoveAllExceptHost),
            }
          : null
      case 'manage_participants':
        return {
          label: 'Manage participants',
          icon: Icons.Users,
          active: panel === 'people',
          onPress: runFromFlyout(onTogglePeople),
        }
    }
  }

  const renderPrimary = (key: MeetingToolbarPrimaryKey) => {
    switch (key) {
      case 'mic':
        return (
          <ControlButton
            key={key}
            label={audioEnabled ? 'Mute' : 'Unmute'}
            icon={audioEnabled ? Icons.Mic : Icons.MicOff}
            variant={audioEnabled ? 'neutral' : 'off'}
            onPress={onToggleAudio}
            compact={compact}
          />
        )
      case 'camera':
        return (
          <ControlButton
            key={key}
            label="Camera"
            icon={videoEnabled ? Icons.Video : Icons.VideoOff}
            variant={videoEnabled ? 'neutral' : 'off'}
            onPress={onToggleVideo}
            compact={compact}
          />
        )
      case 'security':
        return (
          <ControlButton
            key={key}
            label={onToggleHostTools ? 'Host tools' : 'Security'}
            icon={isLocked ? Icons.Lock : Icons.Shield}
            variant={
              isLocked || flyout === 'security' || panel === 'host_tools' ? 'brand' : 'neutral'
            }
            onPress={() => {
              if (onToggleHostTools) {
                setFlyout('none')
                onToggleHostTools()
                return
              }
              toggleFlyout('security')
            }}
            compact={compact}
          />
        )
      case 'participants':
        return (
          <ControlButton
            key={key}
            label="Participants"
            icon={Icons.Users}
            variant={panel === 'people' || raisedHandCount > 0 ? 'brand' : 'neutral'}
            onPress={onTogglePeople}
            compact={compact}
            badgeCount={raisedHandCount}
          />
        )
      case 'chat':
        return (
          <ControlButton
            key={key}
            label={meetingChatToolbarLabel(unreadChatCount)}
            icon={Icons.MessageSquare}
            variant={panel === 'chat' || unreadChatCount > 0 ? 'brand' : 'neutral'}
            onPress={onToggleChat}
            compact={compact}
            badgeCount={unreadChatCount}
          />
        )
      case 'reactions':
        return onToggleReactions ? (
          <ControlButton
            key={key}
            label="React"
            icon={Icons.Smile}
            variant={reactionTrayOpen ? 'brand' : 'neutral'}
            onPress={openReactions}
            compact={compact}
          />
        ) : null
      case 'raise_hand':
        return (
          <ControlButton
            key={key}
            label={handRaised ? 'Lower' : 'Hand'}
            icon={Icons.Hand}
            variant={handRaised ? 'brand' : 'neutral'}
            onPress={onToggleHand}
            compact={compact}
          />
        )
      case 'stop_record':
        return (
          <ControlButton
            key={key}
            label="Stop"
            icon={Icons.Circle}
            variant="danger"
            onPress={onToggleRecord}
            compact={compact}
          />
        )
      case 'share_screen':
        return (
          <ControlButton
            key={key}
            label={screenSharing ? 'Stop share' : 'Share'}
            icon={Icons.ScreenShare}
            variant={screenSharing ? 'brand' : 'neutral'}
            onPress={onToggleScreen}
            compact={compact}
          />
        )
      case 'captions':
        return (
          <ControlButton
            key={key}
            label="Captions"
            icon={Icons.Captions}
            variant={captionsActive ? 'brand' : 'neutral'}
            onPress={onToggleCaptions}
            compact={compact}
          />
        )
      case 'invite':
        return (
          <ControlButton
            key={key}
            label="Invite"
            icon={Icons.UserPlus}
            variant={panel === 'invite' ? 'brand' : 'neutral'}
            onPress={onToggleInvite ?? onShare ?? onToggleInfo}
            compact={compact}
          />
        )
      case 'browse':
        return onMinimize ? (
          <ControlButton
            key={key}
            label="Minimize"
            icon={Icons.Minimize2}
            variant="neutral"
            onPress={onMinimize}
            compact={compact}
          />
        ) : null
      case 'more':
      case 'leave':
      case 'end_meeting':
        return null
    }
  }

  const mediaKeys = primaryKeys.filter(
    (key) => key !== 'leave' && key !== 'end_meeting' && key !== 'more',
  )
  const showMore = primaryKeys.includes('more')
  const showLeave = primaryKeys.includes('leave')
  const showEnd = primaryKeys.includes('end_meeting')
  const securityItems = securityKeys.map(overflowLabel).filter(Boolean) as NonNullable<
    ReturnType<typeof overflowLabel>
  >[]
  const moreSectionItems = moreSections
    .map((section) => ({
      title: section.title,
      items: section.keys.map(overflowLabel).filter(Boolean) as NonNullable<
        ReturnType<typeof overflowLabel>
      >[],
    }))
    .filter((section) => section.items.length > 0)

  const mediaRow = (
    <XStack
      paddingHorizontal="$1"
      alignItems="center"
      gap={roomy ? '$1.5' : compact ? '$1' : '$1.5'}
    >
      {mediaKeys.map(renderPrimary)}
    </XStack>
  )

  return (
    <YStack
      width="100%"
      paddingHorizontal={roomy ? '$4' : '$2.5'}
      paddingTop="$1.5"
      paddingBottom={bottomPad}
      alignItems="center"
      zIndex={MEETING_TOOLBAR_Z_INDEX}
      pointerEvents="auto"
    >
      <YStack
        width="100%"
        maxWidth="100%"
        position="relative"
        borderRadius={coworkUi.radius.dock}
        borderWidth={1}
        borderColor={coworkUi.glassBorder}
        paddingVertical={roomy ? '$2' : '$1.5'}
        paddingHorizontal="$1.5"
        pointerEvents="auto"
        style={{
          ...meetingBarStyle(coworkUi, true),
          ...coworkBoxShadow(coworkShadows, 'dock'),
        }}
      >
        {onToggleReactions && onSendReaction ? (
          <MeetingReactionTray open={reactionTrayOpen} onSelect={onSendReaction} />
        ) : null}
        <MeetingFlyoutPanel
          open={flyout === 'security' && securityItems.length > 0}
          width={flyoutWidth}
          maxHeight={flyoutMaxHeight}
          align="left"
        >
          <Text
            paddingHorizontal="$3"
            paddingBottom="$1"
            fontSize={11}
            fontWeight="800"
            color={coworkUi.meetingIconMuted}
          >
            Security
          </Text>
          <YStack paddingHorizontal="$1" gap={2}>
            {securityItems.map((item) => (
              <OverflowItem
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.active}
                danger={item.danger}
                disabled={item.disabled}
                onPress={item.onPress}
              />
            ))}
          </YStack>
        </MeetingFlyoutPanel>

        <XStack width="100%" alignItems="center" gap="$2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={{ alignItems: 'center', paddingRight: 8 }}
            style={{ flex: 1, minWidth: 0 }}
          >
            {mediaRow}
          </ScrollView>

          {showMore ? (
            <YStack
              position="relative"
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              zIndex={3}
            >
              <MeetingFlyoutPanel
                open={flyout === 'more' && moreSectionItems.length > 0}
                width={flyoutWidth}
                maxHeight={flyoutMaxHeight}
                align="right"
              >
                <YStack paddingHorizontal="$1" gap="$2">
                  {moreSectionItems.map((section) => (
                    <YStack key={section.title} gap={2}>
                      <Text
                        paddingHorizontal="$3"
                        paddingTop="$1"
                        fontSize={11}
                        fontWeight="800"
                        color={coworkUi.meetingIconMuted}
                      >
                        {section.title}
                      </Text>
                      {section.items.map((item) => (
                        <OverflowItem
                          key={item.label}
                          label={item.label}
                          icon={item.icon}
                          active={item.active}
                          danger={item.danger}
                          disabled={item.disabled}
                          onPress={item.onPress}
                        />
                      ))}
                    </YStack>
                  ))}
                </YStack>
              </MeetingFlyoutPanel>
              <ControlButton
                label="More"
                icon={Icons.MoreHorizontal}
                variant={flyout === 'more' ? 'brand' : 'neutral'}
                onPress={() => toggleFlyout('more')}
                compact={compact}
              />
            </YStack>
          ) : null}

          <XStack
            alignItems="center"
            gap={compact ? '$1' : '$1.5'}
            flexShrink={0}
            paddingLeft="$1"
            pointerEvents="auto"
            zIndex={2}
          >
            {showLeave ? (
              <Button
                tone="outline"
                size={compact ? '$2' : '$3'}
                borderRadius={999}
                borderColor="rgba(244,63,104,0.45)"
                color={coworkUi.danger}
                backgroundColor={coworkUi.dangerMuted}
                cursor="pointer"
                disabled={busy}
                opacity={busy ? 0.55 : 1}
                accessibilityRole="button"
                accessibilityLabel="Leave meeting"
                onPress={onLeave}
              >
                {busy ? 'Leaving…' : 'Leave'}
              </Button>
            ) : null}
            {showEnd ? (
              <Button
                tone="primary"
                size={compact ? '$2' : '$3'}
                borderRadius={999}
                backgroundColor={coworkUi.danger}
                cursor="pointer"
                disabled={busy}
                opacity={busy ? 0.55 : 1}
                accessibilityRole="button"
                accessibilityLabel="End meeting for everyone"
                onPress={onEnd}
                style={controlGradientStyle(coworkGradients.dangerControl, coworkUi.danger)}
              >
                {busy ? 'Ending…' : 'End'}
              </Button>
            ) : null}
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )
}
