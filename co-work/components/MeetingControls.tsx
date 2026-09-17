import { useState } from 'react'

import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingReactionTray } from '~/co-work/components/MeetingReactionTray'
import { useAppLayout } from '~/hooks/useAppLayout'
import { meetingChatToolbarLabel } from '~/co-work/lib/meeting-chat'
import {
  MEETING_TOOLBAR_Z_INDEX,
  meetingToolbarMoreKeys,
  meetingToolbarPrimaryKeys,
  meetingToolbarSecurityKeys,
  type MeetingToolbarOverflowKey,
  type MeetingToolbarPrimaryKey,
} from '~/co-work/lib/meeting-toolbar'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow } from '~/lib/platform/crossStyles'
import type { MediaCapabilities, MeetingRole } from '~/co-work/lib/types'

type MeetingControlsProps = {
  caps: MediaCapabilities
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  handRaised: boolean
  recording: boolean
  captionsActive: boolean
  isHost: boolean
  viewerRole?: MeetingRole
  canModerate?: boolean
  /** Lock / mute-all / remove-all — host only. */
  canChangeCriticalSettings?: boolean
  isLocked?: boolean
  panel: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings' | 'backgrounds' | 'audio'
  backgroundActive?: boolean
  unreadChatCount?: number
  raisedHandCount?: number
  reactionTrayOpen?: boolean
  busy?: boolean
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
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const styles = {
    neutral: {
      bg: 'rgba(255,255,255,0.07)',
      border: coworkUi.glassBorder,
      icon: coworkUi.text,
      label: coworkUi.textMuted,
      webBg: undefined as string | undefined,
    },
    brand: {
      bg: coworkUi.brand,
      border: coworkUi.brandLight,
      icon: 'white',
      label: coworkUi.brandLight,
      webBg: coworkGradients.activeControl,
    },
    danger: {
      bg: coworkUi.danger,
      border: '#ff8fa3',
      icon: 'white',
      label: coworkUi.danger,
      webBg: coworkGradients.dangerControl,
    },
    off: {
      bg: coworkUi.dangerMuted,
      border: 'rgba(244,63,104,0.45)',
      icon: coworkUi.danger,
      label: coworkUi.danger,
      webBg: undefined,
    },
  }[variant]

  const badge =
    badgeCount && badgeCount > 0 ? (badgeCount > 9 ? '9+' : String(badgeCount)) : null

  return (
    <YStack
      alignItems="center"
      gap={compact ? 0 : 4}
      minWidth={compact ? 46 : Math.max(52, label.length > 8 ? 64 : 52)}
      flexShrink={0}
      maxWidth={compact ? 72 : 88}
    >
      <YStack position="relative">
        <Button
          aria-label={label}
          width={compact ? 46 : 52}
          height={compact ? 46 : 52}
          padding={0}
          borderRadius={coworkUi.radius.control}
          borderWidth={1}
          borderColor={styles.border}
          backgroundColor={styles.bg}
          hoverStyle={{ opacity: 0.92, scale: 1.02 }}
          pressStyle={{ opacity: 0.86, scale: 0.96 }}
          onPress={onPress}
          style={styles.webBg ? controlGradientStyle(styles.webBg, styles.bg) : undefined}
          icon={<Icon size={compact ? 18 : 20} color={styles.icon} />}
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
      ) : badgeCount && badgeCount > 0 ? (
        <Text fontSize={9} fontWeight="700" color={styles.label} textAlign="center" numberOfLines={1}>
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
  onPress,
}: {
  label: string
  icon: typeof Icons.Mic
  active?: boolean
  danger?: boolean
  onPress: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const color = danger ? coworkUi.danger : active ? coworkUi.brandLight : coworkUi.text
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius={12}
      minHeight={44}
      hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
      pressStyle={{ opacity: 0.8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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
  handRaised,
  recording,
  captionsActive,
  isHost,
  viewerRole,
  canModerate: _canModerate = isHost,
  canChangeCriticalSettings: _canChangeCriticalSettings = isHost,
  isLocked = false,
  panel,
  unreadChatCount = 0,
  raisedHandCount = 0,
  reactionTrayOpen = false,
  busy = false,
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
  const compact = forceCompact || (isMobile && !isTablet && !isDesktop)
  const roomy = !forceCompact && (isTablet || isDesktop)
  const bottomPad = forceCompact ? '$1.5' : '$2'
  const [flyout, setFlyout] = useState<FlyoutKind>('none')

  const role: MeetingRole = viewerRole ?? (isHost ? 'host' : canModerate ? 'co_host' : 'participant')
  const primaryKeys = meetingToolbarPrimaryKeys({
    viewerRole: role,
    supportsVideo: caps.supportsVideo,
    supportsScreenShare: caps.supportsScreenShare,
    supportsLiveCaptions: caps.supportsLiveCaptions,
    hasBrowse: !!onMinimize,
  })
  const securityKeys = meetingToolbarSecurityKeys(role)
  const moreKeys = meetingToolbarMoreKeys({
    viewerRole: role,
    supportsRecording: caps.supportsRecording,
    supportsVideo: caps.supportsVideo,
    hasAudioSettings: !!onOpenAudioSettings,
    hasShareLink: !!onShare,
    hasFullscreen: !!onToggleFullscreen,
    hasMinimize: !!onMinimize,
    hasPictureInPicture: !!onPictureInPicture,
  })

  const closeFlyout = () => setFlyout('none')
  const runFromFlyout = (action?: () => void) => () => {
    closeFlyout()
    action?.()
  }
  const toggleFlyout = (kind: Exclude<FlyoutKind, 'none'>) => {
    setFlyout((current) => (current === kind ? 'none' : kind))
  }

  const overflowLabel = (key: MeetingToolbarOverflowKey): { label: string; icon: typeof Icons.Mic; active?: boolean; danger?: boolean; onPress: () => void } | null => {
    switch (key) {
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
              label: 'Minimize',
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
            variant={audioEnabled ? 'neutral' : 'danger'}
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
            variant={videoEnabled ? 'neutral' : 'danger'}
            onPress={onToggleVideo}
            compact={compact}
          />
        )
      case 'security':
        return (
          <ControlButton
            key={key}
            label="Security"
            icon={isLocked ? Icons.Lock : Icons.Shield}
            variant={isLocked || flyout === 'security' ? 'brand' : 'neutral'}
            onPress={() => toggleFlyout('security')}
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
      case 'share_screen':
        return (
          <ControlButton
            key={key}
            label={screenSharing ? 'Stop share' : 'Share Screen'}
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
            variant="brand"
            onPress={onMinimize}
            compact={compact}
          />
        ) : null
      case 'more':
        return (
          <ControlButton
            key={key}
            label="More"
            icon={Icons.MoreHorizontal}
            variant={flyout === 'more' ? 'brand' : 'neutral'}
            onPress={() => toggleFlyout('more')}
            compact={compact}
          />
        )
      case 'leave':
      case 'end_meeting':
        return null
    }
  }

  const mediaKeys = primaryKeys.filter((key) => key !== 'leave' && key !== 'end_meeting')
  const showLeave = primaryKeys.includes('leave')
  const showEnd = primaryKeys.includes('end_meeting')
  const activeFlyoutKeys = flyout === 'security' ? securityKeys : flyout === 'more' ? moreKeys : []
  const flyoutItems = activeFlyoutKeys.map(overflowLabel).filter(Boolean) as NonNullable<
    ReturnType<typeof overflowLabel>
  >[]

  const mediaRow = (
    <XStack
      paddingHorizontal="$1"
      alignItems="center"
      gap={roomy ? '$2' : compact ? '$1' : '$1.5'}
      justifyContent={undefined}
      flexWrap={undefined}
    >
      {mediaKeys.map(renderPrimary)}
    </XStack>
  )

  return (
    <YStack
      width="100%"
      paddingHorizontal={roomy ? '$5' : '$3'}
      paddingTop="$2"
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
        paddingVertical={roomy ? '$2.5' : '$2'}
        paddingHorizontal="$2"
        pointerEvents="auto"
        style={{
          ...coworkGlassStyle(coworkUi, true),
          ...coworkBoxShadow(coworkShadows, 'dock'),
        }}
      >
        {onToggleReactions && onSendReaction ? (
          <MeetingReactionTray open={reactionTrayOpen} onSelect={onSendReaction} />
        ) : null}
        {flyout !== 'none' && flyoutItems.length > 0 ? (
          <YStack
            position="absolute"
            bottom="100%"
            right={roomy ? 12 : 8}
            left={flyout === 'security' && roomy ? undefined : undefined}
            marginBottom="$2"
            width={roomy ? 280 : 248}
            maxHeight={340}
            borderRadius={16}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            paddingVertical="$2"
            zIndex={MEETING_TOOLBAR_Z_INDEX + 10}
            pointerEvents="auto"
            style={{
              ...coworkGlassStyle(coworkUi, true),
              ...coworkBoxShadow(coworkShadows, 'dock'),
            }}
          >
            <Text
              paddingHorizontal="$3"
              paddingBottom="$1"
              fontSize={11}
              fontWeight="800"
              color={coworkUi.textMuted}
            >
              {flyout === 'security' ? 'Security' : 'More'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <YStack paddingHorizontal="$1" gap={2}>
                {flyoutItems.map((item) => (
                  <OverflowItem
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    active={item.active}
                    danger={item.danger}
                    onPress={item.onPress}
                  />
                ))}
              </YStack>
            </ScrollView>
          </YStack>
        ) : null}

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
                {busy ? 'Ending…' : 'End Meeting'}
              </Button>
            ) : null}
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )
}
