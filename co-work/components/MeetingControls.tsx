import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ViewportOverlay } from '~/components/layout'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingReactionTray } from '~/co-work/components/MeetingReactionTray'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useAppLayout } from '~/hooks/useAppLayout'
import { meetingChatToolbarLabel } from '~/co-work/lib/meeting-chat'
import {
  MEETING_PORTAL_Z_INDEX,
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarChrome,
  meetingToolbarIpadMoreKeys,
  meetingToolbarMoreSections,
  meetingToolbarPrimaryKeys,
  meetingToolbarPrimaryLabel,
  meetingToolbarSecurityKeys,
  type MeetingToolbarOverflowKey,
  type MeetingToolbarPrimaryKey,
} from '~/co-work/lib/meeting-toolbar'
import { resolveParticipantsToolbarBadge } from '~/co-work/lib/meeting-tile-actions'
import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow } from '~/lib/platform/crossStyles'
import type { MediaCapabilities, MeetingRole } from '~/co-work/lib/types'
import {
  MeetingAudioDeviceFlyout,
  MeetingVideoDeviceFlyout,
} from '~/co-work/components/MeetingAudioDeviceMenu'
import { MeetingEndDialog } from '~/co-work/components/MeetingEndDialog'
import { MeetingMobileMoreSheet } from '~/co-work/components/MeetingMobileMoreSheet'
import type { MeetingAudioQuality } from '~/co-work/lib/meeting-audio-quality'

type MeetingControlsProps = {
  caps: MediaCapabilities
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  whiteboardActive?: boolean
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
  panel: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio' | 'host_tools' | 'polls' | 'qna' | 'breakouts'
  backgroundActive?: boolean
  unreadChatCount?: number
  raisedHandCount?: number
  /** Admitted participant count — shown on the footer Participants control. */
  participantCount?: number
  reactionTrayOpen?: boolean
  busy?: boolean
  viewMode?: MeetingViewMode
  mirrorLocalVideo?: boolean
  hideSelfView?: boolean
  denseGallery?: boolean
  uiMaximized?: boolean
  onSetViewMode?: (viewMode: MeetingViewMode) => void
  onToggleMirror?: () => void
  onToggleHideSelfView?: () => void
  hideNonVideoParticipants?: boolean
  onToggleHideNonVideo?: () => void
  activeSpeakersOnly?: boolean
  onToggleActiveSpeakersOnly?: () => void
  sideBySideShare?: boolean
  onToggleSideBySideShare?: () => void
  stopIncomingVideo?: boolean
  onToggleStopIncomingVideo?: () => void
  enterExitSound?: boolean
  onToggleEnterExitSound?: () => void
  onShowKeyboardShortcuts?: () => void
  onToggleDenseGallery?: () => void
  onToggleMaximize?: () => void
  onTogglePinToolbar?: () => void
  controlsPinned?: boolean
  onToggleOriginalSound?: () => void
  originalSound?: boolean
  onToggleHdVideo?: () => void
  hdVideo?: boolean
  onToggleAudio: () => void
  onOpenAudioSettings?: () => void
  onOpenAudioTest?: () => void
  /** LiveKit device switching — mic/speaker/camera flyouts no-op without this. */
  audioQuality?: MeetingAudioQuality
  onToggleVideo: () => void
  onOpenVideoSettings?: () => void
  onToggleBackgrounds?: () => void
  onToggleScreen: () => void
  onToggleHand: () => void
  onToggleReactions?: () => void
  /** Always close the tray — never toggle. Used after a reaction is picked. */
  onCloseReactions?: () => void
  onSendReaction?: (emoji: string) => void
  onSelectNonverbal?: (status: import('~/co-work/lib/meeting-nonverbal').MeetingNonverbalStatusId | null) => void
  activeNonverbal?: import('~/co-work/lib/meeting-nonverbal').MeetingNonverbalStatusId | null
  onToggleRecord: () => void
  onToggleCaptions: () => void
  onToggleChat: () => void
  onTogglePeople: () => void
  onToggleInfo: () => void
  onToggleInvite?: () => void
  onToggleHostTools?: () => void
  onTogglePolls?: () => void
  onToggleQa?: () => void
  onToggleBreakouts?: () => void
  onOpenWhiteboard?: () => void
  onOpenDualMonitor?: () => void
  onToggleAnnotateShare?: () => void
  annotateShareActive?: boolean
  onRequestRemoteControl?: () => void
  onShare?: () => void
  onLeave: () => void
  onEnd: () => void
  onMuteAll?: () => void
  onAskAllToMute?: () => void
  onAskAllToUnmute?: () => void
  onRemoveAllExceptHost?: () => void
  onToggleLock?: () => void
  /** Toggle waiting room from Security flyout. */
  onToggleWaitingRoom?: () => void
  waitingRoomEnabled?: boolean
  /** Mute / video-off on entry toggles from Security flyout. */
  onToggleMuteOnJoin?: () => void
  muteOnJoin?: boolean
  onToggleVideoOffOnJoin?: () => void
  videoOffOnJoin?: boolean
  /** Waiting-room count for People badge urgency. */
  waitingCount?: number
  /** Web Fullscreen API — omit on native. */
  onToggleFullscreen?: () => void
  fullscreenActive?: boolean
  /** Shrink to app-wide mini-player while browsing other tabs. */
  onMinimize?: () => void
  /** OS Picture-in-Picture where supported. */
  onPictureInPicture?: () => void
  /** Disconnect from conference audio (Zoom mobile). */
  onDisconnectAudio?: () => void
  /** Open meeting settings / audio panel. */
  onOpenSettings?: () => void
  /** Enter Zoom-style safe driving mode. */
  onOpenSafeDriving?: () => void
  /** Zoom Docs dock control — share documents / files. */
  onOpenDocs?: () => void
  /** Zoom Apps dock control — polls, Q&A, whiteboard, breakouts. */
  onOpenApps?: () => void
  /** Orientation policy can force compact dock (e.g. landscape phone). */
  forceCompact?: boolean
}

type ControlVariant = 'neutral' | 'brand' | 'danger' | 'off'
type FlyoutKind = 'none' | 'more' | 'security' | 'audio_device' | 'video_device'

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
        maxHeight: panelMaxHeight,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={{ maxHeight: panelMaxHeight - 12 }}
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
        <View style={{ flex: 1 }} collapsable={false}>
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
          <View
            pointerEvents="box-none"
            collapsable={false}
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              alignItems: align === 'right' ? 'flex-end' : 'flex-start',
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 12) + 72,
            }}
          >
            <View pointerEvents="auto" collapsable={false}>
              {panelBody(nativeMaxHeight)}
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function SplitControlButton({
  label,
  icon: Icon,
  variant,
  onPress,
  onCaretPress,
  caretLabel,
  compact,
}: {
  label: string
  icon: typeof Icons.Mic
  variant: ControlVariant
  onPress: () => void
  onCaretPress: () => void
  /** Overrides the caret a11y label (e.g. “Background & camera options”). */
  caretLabel?: string
  compact?: boolean
}) {
  const h = compact ? 40 : 44
  const isOff = variant === 'off'

  return (
    <YStack alignItems="center" gap={3} minWidth={compact ? 60 : 72} flexShrink={0}>
      <XStack
        height={h}
        borderRadius={10}
        backgroundColor={isOff ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.12)'}
        borderWidth={1}
        borderColor={isOff ? 'rgba(239, 68, 68, 0.55)' : 'rgba(255, 255, 255, 0.18)'}
        alignItems="center"
        overflow="hidden"
        elevation={Platform.OS === 'android' ? 4 : undefined}
      >
        {/* Main Action (Icon) */}
        <Pressable
          onPress={onPress}
          hitSlop={6}
          style={({ hovered, pressed }) => ({
            paddingHorizontal: compact ? 10 : 12,
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: pressed
              ? 'rgba(255,255,255,0.18)'
              : hovered
                ? 'rgba(255,255,255,0.12)'
                : 'transparent',
          })}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {Icon ? <Icon size={compact ? 19 : 21} color={isOff ? '#EF4444' : '#FFFFFF'} /> : null}
        </Pressable>

        {/* Thin Divider */}
        <YStack width={1} height={20} backgroundColor="rgba(255, 255, 255, 0.2)" />

        {/* Caret Button */}
        <Pressable
          onPress={onCaretPress}
          hitSlop={6}
          style={({ hovered, pressed }) => ({
            paddingHorizontal: compact ? 7 : 9,
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: pressed
              ? 'rgba(255,255,255,0.18)'
              : hovered
                ? 'rgba(255,255,255,0.12)'
                : 'transparent',
          })}
          accessibilityRole="button"
          accessibilityLabel={caretLabel ?? `${label} options`}
        >
          <Icons.ChevronUp size={14} color="rgba(255, 255, 255, 0.85)" />
        </Pressable>
      </XStack>

      <Text
        fontSize={compact ? 9 : 10}
        fontWeight="700"
        color={isOff ? '#EF4444' : '#E2E8F0'}
        textAlign="center"
        numberOfLines={1}
      >
        {label}
      </Text>
    </YStack>
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
  const size = compact ? 36 : 40
  const isBrand = variant === 'brand'
  const isDanger = variant === 'danger'
  const isOff = variant === 'off'

  const bg = isBrand
    ? coworkUi.meetingControlActive
    : isDanger
      ? '#E02828'
      : isOff
        ? 'rgba(239, 68, 68, 0.22)'
        : 'transparent'

  const iconColor = isOff ? '#EF4444' : '#FFFFFF'
  const labelColor = isBrand
    ? coworkUi.brandLight
    : isDanger || isOff
      ? '#EF4444'
      : '#CBD5E1'

  const badge =
    badgeCount && badgeCount > 0
      ? badgeCount > 99
        ? '99+'
        : String(badgeCount)
      : null

  return (
    <YStack
      alignItems="center"
      gap={3}
      minWidth={compact ? 52 : 52}
      maxWidth={compact ? 72 : 76}
      flexShrink={1}
      flexGrow={compact ? 1 : 0}
    >
      <XStack position="relative" alignItems="center">
        <Pressable
          onPress={onPress}
          style={({ hovered, pressed }) => ({
            width: size,
            height: size,
            borderRadius: isDanger ? 10 : 8,
            backgroundColor: bg !== 'transparent'
              ? bg
              : pressed
                ? 'rgba(255, 255, 255, 0.16)'
                : hovered
                  ? 'rgba(255, 255, 255, 0.09)'
                  : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor:
              isBrand || isDanger
                ? 'transparent'
                : isOff
                  ? 'rgba(239, 68, 68, 0.45)'
                  : 'rgba(255, 255, 255, 0.08)',
          })}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {Icon ? <Icon size={compact ? 17 : 19} color={iconColor} /> : null}
        </Pressable>

        {badge ? (
          <YStack
            position="absolute"
            top={-3}
            right={-5}
            minWidth={16}
            height={16}
            paddingHorizontal={4}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor="#EF4444"
            borderWidth={1}
            borderColor="rgba(0,0,0,0.5)"
            zIndex={2}
          >
            <Text fontSize={9} fontWeight="800" color="#fff">
              {badge}
            </Text>
          </YStack>
        ) : null}
      </XStack>

      <Text
        fontSize={compact ? 9 : 10}
        fontWeight="700"
        color={labelColor}
        textAlign="center"
        numberOfLines={1}
      >
        {label}
      </Text>
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
    <Pressable
      disabled={!!disabled}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active && !disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
        backgroundColor: active && !disabled ? 'rgba(216,27,96,0.12)' : 'transparent',
        borderRadius: 12,
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 12,
      })}
    >
      <XStack alignItems="center" gap="$2.5" pointerEvents="none">
        <Icon size={17} color={color} />
        <Text fontSize={14} fontWeight="700" color={color} numberOfLines={1}>
          {label}
        </Text>
      </XStack>
    </Pressable>
  )
}

export function MeetingControls({
  caps,
  audioEnabled,
  videoEnabled,
  backgroundActive = false,
  screenSharing,
  whiteboardActive = false,
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
  participantCount = 0,
  reactionTrayOpen = false,
  busy = false,
  viewMode = 'gallery',
  mirrorLocalVideo = false,
  hideSelfView = false,
  denseGallery = false,
  uiMaximized = false,
  onSetViewMode,
  onToggleMirror,
  onToggleHideSelfView,
  hideNonVideoParticipants = false,
  onToggleHideNonVideo,
  activeSpeakersOnly = false,
  onToggleActiveSpeakersOnly,
  sideBySideShare = false,
  onToggleSideBySideShare,
  stopIncomingVideo = false,
  onToggleStopIncomingVideo,
  enterExitSound = true,
  onToggleEnterExitSound,
  onShowKeyboardShortcuts,
  onToggleDenseGallery,
  onToggleMaximize,
  onTogglePinToolbar,
  controlsPinned = false,
  onToggleOriginalSound,
  originalSound = false,
  onToggleHdVideo,
  hdVideo = true,
  onToggleAudio,
  onOpenAudioSettings,
  onOpenAudioTest,
  audioQuality,
  onToggleVideo,
  onOpenVideoSettings,
  onToggleBackgrounds,
  onToggleScreen,
  onToggleHand,
  onToggleReactions,
  onCloseReactions,
  onSendReaction,
  onSelectNonverbal,
  activeNonverbal = null,
  onToggleRecord,
  onToggleCaptions,
  onToggleChat,
  onTogglePeople,
  onToggleInfo,
  onToggleInvite,
  onToggleHostTools,
  onTogglePolls,
  onToggleQa,
  onToggleBreakouts,
  onOpenWhiteboard,
  onOpenDualMonitor,
  onToggleAnnotateShare,
  annotateShareActive = false,
  onRequestRemoteControl,
  onShare,
  onLeave,
  onEnd,
  onMuteAll,
  onAskAllToMute,
  onAskAllToUnmute,
  onRemoveAllExceptHost,
  onToggleLock,
  onToggleWaitingRoom,
  waitingRoomEnabled = false,
  onToggleMuteOnJoin,
  muteOnJoin = false,
  onToggleVideoOffOnJoin,
  videoOffOnJoin = false,
  waitingCount = 0,
  onToggleFullscreen,
  fullscreenActive = false,
  onMinimize,
  onPictureInPicture,
  onDisconnectAudio,
  onOpenSettings,
  onOpenSafeDriving,
  onOpenDocs,
  onOpenApps,
  forceCompact,
}: MeetingControlsProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const { isMobile, isTablet, isDesktop } = useAppLayout()
  const { height: windowHeight } = useWindowDimensions()
  const compact = forceCompact || (isMobile && !isTablet && !isDesktop)
  const roomy = !forceCompact && (isTablet || isDesktop)
  const bottomPad = forceCompact ? '$1.5' : '$2'
  // Zoom web ≥861 / Zoom mobile (phone, tablet, native) — see meetingToolbarChrome.
  const toolbarChrome = meetingToolbarChrome({ compact })
  const [flyout, setFlyout] = useState<FlyoutKind>('none')
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const { setExtraSurfaceBlock } = useMeetingLiveSignals()
  useEffect(() => {
    // More / Security use RN Modal (separate window) — keep camera tiles live.
    // Audio / video device menus are in-tree overlays; on Android, WebRTC
    // SurfaceViews steal taps unless we briefly hide them.
    const needsSurfaceBlock =
      Platform.OS !== 'web' && (flyout === 'audio_device' || flyout === 'video_device')
    setExtraSurfaceBlock(needsSurfaceBlock)
    return () => setExtraSurfaceBlock(false)
  }, [flyout, setExtraSurfaceBlock])
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
    chrome: toolbarChrome,
    supportsRecording: caps.supportsRecording,
    recording,
    hasReactions,
    hasRaiseHand,
    hasWhiteboard: !!onOpenWhiteboard,
    hasDocs: !!(onOpenDocs || onToggleInvite || onShare || onOpenWhiteboard),
    hasApps: !!(onOpenApps || onTogglePolls || onToggleQa),
  })
  const securityKeys = meetingToolbarSecurityKeys(role)
  const reactionsOnPrimary = primaryKeys.includes('reactions')
  const raiseHandOnPrimary = primaryKeys.includes('raise_hand')
  const captionsOnPrimary = primaryKeys.includes('captions')
  const whiteboardOnPrimary = primaryKeys.includes('whiteboard')
  const inviteOnPrimary = primaryKeys.includes('invite') || primaryKeys.includes('docs')
  const recordOnPrimary =
    primaryKeys.includes('record') || primaryKeys.includes('stop_record')
  const moreSections = meetingToolbarMoreSections({
    viewerRole: role,
    supportsRecording: caps.supportsRecording,
    supportsVideo: caps.supportsVideo,
    hasAudioSettings: !!onOpenAudioSettings,
    hasShareLink: !!onShare,
    hasFullscreen: !!onToggleFullscreen,
    hasMinimize: !!onMinimize,
    hasPictureInPicture: !!onPictureInPicture,
    chrome: toolbarChrome,
    supportsLiveCaptions: caps.supportsLiveCaptions,
    hasInvite: !!(onToggleInvite || onShare),
    hasViewControls: !!(onSetViewMode || onToggleMirror || onToggleMaximize),
    hasDenseGallery: !!onToggleDenseGallery,
    reactionsOnPrimary,
    raiseHandOnPrimary,
    captionsOnPrimary,
    whiteboardOnPrimary,
    inviteOnPrimary,
    recording,
    recordOnPrimary,
    hasBreakouts: !!onToggleBreakouts,
    hasPolls: !!onTogglePolls,
    hasQa: !!onToggleQa,
    hasWhiteboard: !!onOpenWhiteboard,
    hasDualMonitor: !!onOpenDualMonitor,
    hasAnnotateShare: !!onToggleAnnotateShare,
    hasRemoteControl: !!onRequestRemoteControl,
    hasKeyboardShortcuts: !!onShowKeyboardShortcuts,
  })
  const ipadMoreKeys = meetingToolbarIpadMoreKeys({
    viewerRole: role,
    hasHostTools: !!onToggleHostTools,
    hasAudioSettings: !!onOpenAudioSettings,
    hasCaptions: caps.supportsLiveCaptions !== false && !captionsOnPrimary,
    hasSettings: !!onOpenSettings,
    hasVideoEffects: !!onToggleBackgrounds,
    hasDisconnectAudio: !!onDisconnectAudio,
  })
  // When captions are already on the dock, still offer Captions & translations in More.
  if (captionsOnPrimary && caps.supportsLiveCaptions !== false && !ipadMoreKeys.includes('captions')) {
    const audioIdx = ipadMoreKeys.indexOf('audio_settings')
    ipadMoreKeys.splice(audioIdx >= 0 ? audioIdx + 1 : 1, 0, 'captions')
  }
  const primaryLabel = (key: MeetingToolbarPrimaryKey) =>
    meetingToolbarPrimaryLabel(key, {
      chrome: toolbarChrome,
      audioEnabled,
      videoEnabled,
      screenSharing,
      recording,
      participantCount,
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
    if (reactionTrayOpen) {
      onCloseReactions?.()
      return
    }
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
      case 'hide_non_video':
        return onToggleHideNonVideo
          ? {
              label: hideNonVideoParticipants
                ? 'Show non-video participants'
                : 'Hide non-video participants',
              icon: Icons.UserX,
              active: hideNonVideoParticipants,
              onPress: runFromFlyout(onToggleHideNonVideo),
            }
          : null
      case 'active_speakers_only':
        return onToggleActiveSpeakersOnly
          ? {
              label: activeSpeakersOnly ? 'Show all participants' : 'Active speakers only',
              icon: Icons.Activity,
              active: activeSpeakersOnly,
              onPress: runFromFlyout(onToggleActiveSpeakersOnly),
            }
          : null
      case 'side_by_side':
        return onToggleSideBySideShare
          ? {
              label: sideBySideShare ? 'Bottom filmstrip' : 'Side-by-side mode',
              icon: Icons.LayoutGrid,
              active: sideBySideShare,
              onPress: runFromFlyout(onToggleSideBySideShare),
            }
          : null
      case 'stop_incoming_video':
        return onToggleStopIncomingVideo
          ? {
              label: stopIncomingVideo ? 'Start incoming video' : 'Stop incoming video',
              icon: Icons.VideoOff,
              active: stopIncomingVideo,
              onPress: runFromFlyout(onToggleStopIncomingVideo),
            }
          : null
      case 'enter_exit_sound':
        return onToggleEnterExitSound
          ? {
              label: enterExitSound ? 'Mute join/leave sound' : 'Play join/leave sound',
              icon: enterExitSound ? Icons.Bell : Icons.BellOff,
              active: enterExitSound,
              onPress: runFromFlyout(onToggleEnterExitSound),
            }
          : null
      case 'keyboard_shortcuts':
        return onShowKeyboardShortcuts
          ? {
              label: 'Keyboard shortcuts',
              icon: Icons.HelpCircle,
              onPress: runFromFlyout(onShowKeyboardShortcuts),
            }
          : null
      case 'view_dense_gallery':
        return onToggleDenseGallery
          ? {
              label: denseGallery
                ? 'Standard gallery density'
                : 'Dense gallery (more per page)',
              icon: Icons.LayoutGrid,
              active: denseGallery,
              onPress: runFromFlyout(onToggleDenseGallery),
            }
          : null
      case 'whiteboard':
        return onOpenWhiteboard
          ? {
              label: whiteboardActive ? 'Close whiteboard' : 'Whiteboard',
              icon: Icons.PenTool,
              active: whiteboardActive,
              onPress: runFromFlyout(onOpenWhiteboard),
            }
          : null
      case 'polls':
        return onOpenApps || onTogglePolls
          ? {
              label: onOpenApps && !roomy ? 'Apps' : 'Polls',
              icon: onOpenApps && !roomy ? Icons.LayoutGrid : Icons.BarChart3,
              active: panel === 'polls',
              onPress: runFromFlyout(onOpenApps ?? onTogglePolls),
            }
          : null
      case 'qna':
        return onToggleQa
          ? {
              label: 'Q&A',
              icon: Icons.HelpCircle,
              active: panel === 'qna',
              onPress: runFromFlyout(onToggleQa),
            }
          : null
      case 'breakout_rooms':
        return onToggleBreakouts
          ? {
              label: 'Breakout rooms',
              icon: Icons.UsersRound,
              active: panel === 'breakouts',
              onPress: runFromFlyout(onToggleBreakouts),
            }
          : null
      case 'dual_monitor':
        return onOpenDualMonitor
          ? {
              label: 'Open second window',
              icon: Icons.Monitor,
              onPress: runFromFlyout(onOpenDualMonitor),
            }
          : null
      case 'annotate_share':
        return onToggleAnnotateShare
          ? {
              label: annotateShareActive ? 'Stop annotating' : 'Annotate screen share',
              icon: Icons.PenTool,
              active: annotateShareActive,
              onPress: runFromFlyout(onToggleAnnotateShare),
            }
          : null
      case 'request_remote_control':
        return onRequestRemoteControl
          ? {
              label: 'Request remote control',
              icon: Icons.Hand,
              onPress: runFromFlyout(onRequestRemoteControl),
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
      case 'pin_toolbar':
        return onTogglePinToolbar
          ? {
              label: controlsPinned ? 'Unpin toolbar' : 'Pin toolbar',
              icon: Icons.Pin,
              active: controlsPinned,
              onPress: runFromFlyout(onTogglePinToolbar),
            }
          : null
      case 'original_sound':
        return onToggleOriginalSound
          ? {
              label: originalSound ? 'Turn off original sound' : 'Original sound',
              icon: Icons.Volume2,
              active: originalSound,
              onPress: runFromFlyout(onToggleOriginalSound),
            }
          : null
      case 'hd_video':
        return onToggleHdVideo
          ? {
              label: hdVideo ? 'Standard video quality' : 'HD video',
              icon: Icons.Monitor,
              active: hdVideo,
              onPress: runFromFlyout(onToggleHdVideo),
            }
          : null
      case 'chat':
        return {
          label: meetingChatToolbarLabel(unreadChatCount),
          icon: Icons.MessageSquare,
          active: panel === 'chat' || unreadChatCount > 0,
          onPress: runFromFlyout(onToggleChat),
        }
      case 'captions':
        return {
          label: roomy ? 'Captions & translations' : captionsActive ? 'Hide captions' : 'Captions',
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
              label: roomy ? 'Video & effects' : 'Background',
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
      case 'share_screen':
        return {
          label: screenSharing ? 'Stop share' : 'Start share',
          icon: Icons.ScreenShare,
          active: screenSharing,
          onPress: runFromFlyout(onToggleScreen),
        }
      case 'disconnect_audio':
        return onDisconnectAudio
          ? {
              label: 'Disconnect audio',
              icon: Icons.Headphones,
              danger: true,
              onPress: runFromFlyout(onDisconnectAudio),
            }
          : null
      case 'settings':
        return onOpenSettings
          ? {
              label: roomy ? 'Meeting settings' : 'Settings',
              icon: Icons.Settings,
              onPress: runFromFlyout(onOpenSettings),
            }
          : null
      case 'safe_driving':
        return onOpenSafeDriving
          ? {
              label: 'Safe driving mode',
              icon: Icons.Car,
              onPress: runFromFlyout(onOpenSafeDriving),
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
      case 'waiting_room':
        return onToggleWaitingRoom
          ? {
              label: waitingRoomEnabled ? 'Disable waiting room' : 'Enable waiting room',
              icon: Icons.Users,
              active: waitingRoomEnabled,
              onPress: runFromFlyout(onToggleWaitingRoom),
            }
          : null
      case 'mute_on_join':
        return onToggleMuteOnJoin
          ? {
              label: muteOnJoin ? 'Mute on entry: On' : 'Mute on entry: Off',
              icon: Icons.MicOff,
              active: muteOnJoin,
              onPress: runFromFlyout(onToggleMuteOnJoin),
            }
          : null
      case 'video_off_on_join':
        return onToggleVideoOffOnJoin
          ? {
              label: videoOffOnJoin ? 'Video off on entry: On' : 'Video off on entry: Off',
              icon: Icons.VideoOff,
              active: videoOffOnJoin,
              onPress: runFromFlyout(onToggleVideoOffOnJoin),
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
            label={primaryLabel('mic')}
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
            label={primaryLabel('camera')}
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
            label={primaryLabel('security')}
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
            label={primaryLabel('participants')}
            icon={Icons.Users}
            variant={
              panel === 'people' || raisedHandCount > 0 || waitingCount > 0 ? 'brand' : 'neutral'
            }
            onPress={onTogglePeople}
            compact={compact}
            badgeCount={resolveParticipantsToolbarBadge({
              waitingCount,
              raisedHandCount,
              participantCount,
            })}
          />
        )
      case 'chat':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('chat')}
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
            label={primaryLabel('reactions')}
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
            label={handRaised ? 'Lower' : primaryLabel('raise_hand')}
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
            label={primaryLabel('stop_record')}
            icon={Icons.Circle}
            variant="danger"
            onPress={onToggleRecord}
            compact={compact}
          />
        )
      case 'record':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('record')}
            icon={Icons.Circle}
            variant={recording ? 'danger' : 'neutral'}
            onPress={onToggleRecord}
            compact={compact}
          />
        )
      case 'share_screen':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('share_screen')}
            icon={Icons.ScreenShare}
            variant={screenSharing ? 'brand' : 'neutral'}
            onPress={onToggleScreen}
            compact={compact}
          />
        )
      case 'whiteboard':
        return onOpenWhiteboard ? (
          <ControlButton
            key="whiteboard"
            label={primaryLabel('whiteboard')}
            icon={Icons.PenTool}
            variant={whiteboardActive ? 'brand' : 'neutral'}
            onPress={onOpenWhiteboard}
            compact={compact}
          />
        ) : null
      case 'captions':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('captions')}
            icon={Icons.Captions}
            variant={captionsActive ? 'brand' : 'neutral'}
            onPress={onToggleCaptions}
            compact={compact}
          />
        )
      case 'docs':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('docs')}
            icon={Icons.FileText}
            variant="neutral"
            onPress={onOpenDocs ?? onShare ?? onToggleInvite ?? onOpenWhiteboard ?? onToggleInfo}
            compact={compact}
          />
        )
      case 'apps':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('apps')}
            icon={Icons.LayoutGrid}
            variant={panel === 'polls' || panel === 'qna' || panel === 'breakouts' ? 'brand' : 'neutral'}
            onPress={onOpenApps ?? onTogglePolls ?? onToggleQa ?? onOpenWhiteboard}
            compact={compact}
          />
        )
      case 'invite':
        return (
          <ControlButton
            key={key}
            label={primaryLabel('invite')}
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
            label={primaryLabel('browse')}
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
  const showEnd = primaryKeys.includes('end_meeting')
  const securityItems = securityKeys.map(overflowLabel).filter(Boolean) as NonNullable<
    ReturnType<typeof overflowLabel>
  >[]
  const moreSectionItems = roomy
    ? [
        {
          title: '',
          items: ipadMoreKeys
            .map(overflowLabel)
            .filter(Boolean) as NonNullable<ReturnType<typeof overflowLabel>>[],
        },
      ].filter((section) => section.items.length > 0)
    : moreSections
        .map((section) => ({
          title: section.title,
          items: section.keys.map(overflowLabel).filter(Boolean) as NonNullable<
            ReturnType<typeof overflowLabel>
          >[],
        }))
        .filter((section) => section.items.length > 0)

  // Zoom iPad: single floating pill row. Phone: mic/cam left · tools center · leave right.
  const centerKeys = roomy
    ? mediaKeys
    : mediaKeys.filter((key) => key !== 'mic' && key !== 'camera')

  return (
    <YStack
      width="100%"
      paddingHorizontal={roomy ? '$5' : '$2.5'}
      paddingTop="$1.5"
      paddingBottom={bottomPad}
      alignItems="center"
      zIndex={MEETING_TOOLBAR_Z_INDEX}
      pointerEvents="auto"
    >
      <YStack
        width={roomy ? 'auto' : '100%'}
        maxWidth={roomy ? 980 : '100%'}
        alignSelf="center"
        position="relative"
        borderRadius={roomy ? 999 : 16}
        borderWidth={1}
        borderColor="rgba(255, 255, 255, 0.14)"
        paddingVertical={roomy ? '$1.5' : '$1.5'}
        paddingHorizontal={roomy ? '$3' : '$2'}
        pointerEvents="auto"
        style={{
          backgroundColor: roomy ? 'rgba(18, 12, 16, 0.88)' : 'rgba(26, 29, 36, 0.96)',
          backdropFilter: 'blur(24px)',
          boxShadow: roomy
            ? '0 10px 36px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.45)',
          elevation: Platform.OS === 'android' ? 16 : undefined,
          zIndex: MEETING_TOOLBAR_Z_INDEX,
        }}
      >
        {/* Modals & Flyouts */}
        {onToggleReactions && onSendReaction ? (
          <MeetingReactionTray
            open={reactionTrayOpen}
            onSelect={onSendReaction}
            onSelectNonverbal={onSelectNonverbal}
            activeNonverbal={activeNonverbal}
            onRequestClose={() => {
              onCloseReactions?.()
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

        <MeetingAudioDeviceFlyout
          open={flyout === 'audio_device'}
          onClose={closeFlyout}
          onOpenAudioSettings={onOpenAudioSettings}
          onOpenAudioTest={onOpenAudioTest}
          audioQuality={audioQuality}
        />

        <MeetingVideoDeviceFlyout
          open={flyout === 'video_device'}
          onClose={closeFlyout}
          onOpenVirtualBackgrounds={onToggleBackgrounds}
          onOpenVideoSettings={onOpenVideoSettings}
          audioQuality={audioQuality}
        />

        <MeetingEndDialog
          open={endDialogOpen}
          isHost={isHost}
          onClose={() => setEndDialogOpen(false)}
          onLeave={() => {
            setEndDialogOpen(false)
            onLeave()
          }}
          onEndAll={() => {
            setEndDialogOpen(false)
            onEnd()
          }}
        />

        {/* Zoom iPad: one floating pill. Phone: equal Mute · Video · Chat · More · End. */}
        <XStack width="100%" alignItems="center" gap="$1">
          {roomy ? (
            <>
              <XStack
                flexShrink={1}
                alignItems="center"
                justifyContent="center"
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  contentContainerStyle={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: 4,
                    flexGrow: 1,
                  }}
                >
                  {centerKeys.map(renderPrimary)}

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
                        <YStack paddingHorizontal="$1" gap={2}>
                          {moreSectionItems.map((section) => (
                            <YStack key={section.title || 'more'} gap={2}>
                              {section.title ? (
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
                              ) : null}
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
                        compact={false}
                      />
                    </YStack>
                  ) : null}

                  <ControlButton
                    label="End"
                    icon={Icons.X}
                    variant="danger"
                    onPress={() => setEndDialogOpen(true)}
                    compact={false}
                  />
                </ScrollView>
              </XStack>
            </>
          ) : (
            <XStack width="100%" alignItems="flex-end" justifyContent="space-between" gap={2}>
              <ControlButton
                label={primaryLabel('mic')}
                icon={audioEnabled ? Icons.Mic : Icons.MicOff}
                variant={audioEnabled ? 'neutral' : 'off'}
                onPress={onToggleAudio}
                compact={compact}
              />
              {caps.supportsVideo !== false ? (
                <ControlButton
                  label={primaryLabel('camera')}
                  icon={videoEnabled ? Icons.Video : Icons.VideoOff}
                  variant={videoEnabled ? 'neutral' : 'off'}
                  onPress={onToggleVideo}
                  compact={compact}
                />
              ) : null}
              <ControlButton
                label={primaryLabel('chat')}
                icon={Icons.MessageSquare}
                variant={panel === 'chat' ? 'brand' : 'neutral'}
                onPress={onToggleChat}
                compact={compact}
                badgeCount={unreadChatCount}
              />
              <YStack position="relative" alignItems="center" justifyContent="center" zIndex={3}>
                <MeetingMobileMoreSheet
                  open={flyout === 'more'}
                  onClose={closeFlyout}
                  viewerRole={role}
                  handRaised={handRaised}
                  participantCount={participantCount}
                  supportsScreenShare={caps.supportsScreenShare}
                  supportsLiveCaptions={caps.supportsLiveCaptions}
                  hasWhiteboard={!!onOpenWhiteboard}
                  hasHostTools={!!onToggleHostTools}
                  onToggleHand={onToggleHand}
                  onOpenReactions={() => {
                    onToggleReactions?.()
                  }}
                  onSendQuickReaction={(emoji) => onSendReaction?.(emoji)}
                  resolveAction={(key) => {
                    const item = overflowLabel(key)
                    return item?.onPress ?? null
                  }}
                />
                <ControlButton
                  label="More"
                  icon={Icons.MoreHorizontal}
                  variant={flyout === 'more' ? 'brand' : 'neutral'}
                  onPress={() => toggleFlyout('more')}
                  compact={compact}
                />
              </YStack>
              <ControlButton
                label={isHost || showEnd ? 'End' : 'Leave'}
                icon={Icons.X}
                variant="danger"
                onPress={() => setEndDialogOpen(true)}
                compact={compact}
              />
            </XStack>
          )}
        </XStack>
      </YStack>
    </YStack>
  )
}
