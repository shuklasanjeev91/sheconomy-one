import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ViewportOverlay } from '~/components/layout'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingReactionTray } from '~/co-work/components/MeetingReactionTray'
import { useAppLayout } from '~/hooks/useAppLayout'
import { meetingChatToolbarLabel } from '~/co-work/lib/meeting-chat'
import {
  MEETING_PORTAL_Z_INDEX,
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
 * Overflow menu that stays inside the viewport on every platform.
 * - Web: `position: fixed` + body portal (clears InstantMeetingHost overflow/z-index)
 * - Native: transparent Modal (same overflow escape on iOS/Android)
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
  onRequestClose,
  children,
}: {
  open: boolean
  width: number
  maxHeight: number
  align: 'left' | 'right'
  onRequestClose?: () => void
  children: ReactNode
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
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

    const fallbackPos = (): FlyoutPos => ({
      bottom: 96,
      maxHeight: Math.min(
        maxHeight,
        Math.max(180, Math.round((typeof window !== 'undefined' ? window.innerHeight : 640) * 0.45)),
      ),
      ...(align === 'right' ? { right: 16 } : { left: 16 }),
    })

    const measure = () => {
      if (typeof window === 'undefined') return
      if (!anchorEl) {
        setPos(fallbackPos())
        return
      }
      const rect = anchorEl.getBoundingClientRect()
      if (!rect.width && !rect.height && rect.top === 0 && rect.left === 0) {
        setPos(fallbackPos())
        return
      }
      const gap = 10
      const spaceAbove = Math.max(120, Math.round(rect.top - gap - 8))
      const next: FlyoutPos = {
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

  const panelBody = (panelMaxHeight: number) => (
    <YStack
      width={width}
      height={panelMaxHeight}
      maxHeight={panelMaxHeight}
      borderRadius={coworkUi.radius.panel}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      paddingVertical="$2"
      pointerEvents="auto"
      overflow="hidden"
      style={{
        ...meetingBarStyle(coworkUi, true),
        ...coworkBoxShadow(coworkShadows, 'dock'),
        height: panelMaxHeight,
        maxHeight: panelMaxHeight,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, height: panelMaxHeight - 12 }}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {children}
      </ScrollView>
    </YStack>
  )

  if (!open) return anchor

  // Web: portal above InstantMeetingHost (z 90k).
  if (Platform.OS === 'web') {
    if (!pos) return anchor
    return (
      <>
        {anchor}
        <ViewportOverlay>
          <YStack
            position={'fixed' as never}
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={MEETING_PORTAL_Z_INDEX - 1}
            pointerEvents="auto"
            style={{ position: 'fixed', inset: 0, zIndex: MEETING_PORTAL_Z_INDEX - 1 }}
            onPress={onRequestClose}
            accessibilityLabel="Close menu"
          />
          <YStack
            position={'fixed' as never}
            bottom={pos.bottom}
            left={pos.left}
            right={pos.right}
            zIndex={MEETING_PORTAL_Z_INDEX}
            pointerEvents="box-none"
            style={{ position: 'fixed', zIndex: MEETING_PORTAL_Z_INDEX }}
          >
            {panelBody(pos.maxHeight)}
          </YStack>
        </ViewportOverlay>
      </>
    )
  }

  // Native: Modal escapes InstantMeetingHost overflow:hidden (iPad/Android).
  // Tall enough that Browse (minimize) + View stay reachable without feeling clipped.
  const nativeMaxHeight = Math.min(
    Math.max(420, maxHeight),
    Math.max(360, Math.round(windowHeight * 0.78)),
  )
  return (
    <>
      {anchor}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onRequestClose}
      >
        <YStack flex={1} width="100%" height="100%">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={onRequestClose}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(12, 8, 10, 0.35)',
            }}
          />
          <YStack
            flex={1}
            justifyContent="flex-end"
            alignItems={align === 'right' ? 'flex-end' : 'flex-start'}
            paddingHorizontal={16}
            paddingBottom={Math.max(insets.bottom, 12) + 72}
            pointerEvents="box-none"
          >
            {panelBody(nativeMaxHeight)}
          </YStack>
        </YStack>
      </Modal>
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
      label: coworkUi.text,
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
      ? coworkUi.brand
      : disabled
        ? coworkUi.textMuted
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
      <Text fontSize={14} fontWeight="700" color={color} numberOfLines={1}>
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
  // Keep More tall enough for Browse + Record + Host on phone / landscape.
  const flyoutMaxHeight = Math.max(
    240,
    Math.min(compact ? 460 : 420, Math.round(windowHeight * (compact ? 0.62 : 0.55))),
  )
  const flyoutWidth = roomy ? 280 : 248
  const screenShareOnStage = hasActiveScreenShare ?? screenSharing
  const effectiveViewMode: MeetingViewMode =
    viewMode === 'screen-share' && !screenShareOnStage ? 'gallery' : viewMode

  // Prefer authoritative host flag over a stale participant role row — otherwise
  // iPad/Android lose Host tools / End / Record while web (faster role refresh) keeps them.
  const role: MeetingRole = isHost
    ? 'host'
    : viewerRole === 'co_host' || viewerRole === 'host'
      ? viewerRole
      : canModerate
        ? 'co_host'
        : viewerRole ?? 'participant'
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
              label: 'Minimize to bubble',
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
          <MeetingReactionTray
            open={reactionTrayOpen}
            onSelect={onSendReaction}
            onRequestClose={() => {
              if (reactionTrayOpen) onToggleReactions()
            }}
          />
        ) : null}
        <MeetingFlyoutPanel
          open={flyout === 'security' && securityItems.length > 0}
          width={flyoutWidth}
          maxHeight={flyoutMaxHeight}
          align="left"
          onRequestClose={closeFlyout}
        >
          <Text
            paddingHorizontal="$3"
            paddingBottom="$1"
            fontSize={11}
            fontWeight="800"
            color={coworkUi.brand}
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
                onRequestClose={closeFlyout}
              >
                <YStack paddingHorizontal="$1" gap="$2">
                  {moreSectionItems.map((section) => (
                    <YStack key={section.title} gap={2}>
                      <Text
                        paddingHorizontal="$3"
                        paddingTop="$1"
                        fontSize={11}
                        fontWeight="800"
                        letterSpacing={0.4}
                        color={coworkUi.brand}
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
