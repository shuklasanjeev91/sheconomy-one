import { Platform } from 'react-native'

import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingReactionTray } from '~/co-work/components/MeetingReactionTray'
import { useAppLayout } from '~/hooks/useAppLayout'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow } from '~/lib/platform/crossStyles'
import type { MediaCapabilities } from '~/co-work/lib/types'

type MeetingControlsProps = {
  caps: MediaCapabilities
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  handRaised: boolean
  recording: boolean
  captionsActive: boolean
  isHost: boolean
  panel: 'none' | 'chat' | 'people' | 'invite' | 'info' | 'recordings'
  unreadChatCount?: number
  raisedHandCount?: number
  reactionTrayOpen?: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
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
}

type ControlVariant = 'neutral' | 'brand' | 'danger' | 'off'

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
    <YStack alignItems="center" gap={compact ? 0 : 4} minWidth={compact ? 46 : 52} flexShrink={0}>
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
      ) : null}
    </YStack>
  )
}

function DockDivider() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return <YStack width={1} height={32} backgroundColor={coworkUi.glassBorder} marginHorizontal="$1" opacity={0.8} />
}

export function MeetingControls({
  caps,
  audioEnabled,
  videoEnabled,
  screenSharing,
  handRaised,
  recording,
  captionsActive,
  isHost,
  panel,
  unreadChatCount = 0,
  raisedHandCount = 0,
  reactionTrayOpen = false,
  onToggleAudio,
  onToggleVideo,
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
}: MeetingControlsProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const { isMobile, isTablet, isDesktop } = useAppLayout()
  // Compact icon-only dock on phones; tablets/desktops show labels and breathe.
  const compact = isMobile && !isTablet && !isDesktop
  const roomy = isTablet || isDesktop
  // Meeting routes are chromeless + SafeArea — keep a tight dock pad only.
  const bottomPad = '$2'

  return (
    <YStack
      width="100%"
      paddingHorizontal={roomy ? '$5' : '$3'}
      paddingTop="$2"
      paddingBottom={bottomPad}
      alignItems="center"
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
        style={{
          ...coworkGlassStyle(coworkUi, true),
          ...coworkBoxShadow(coworkShadows, 'dock'),
        }}
      >
        {onToggleReactions && onSendReaction ? (
          <MeetingReactionTray open={reactionTrayOpen} onSelect={onSendReaction} />
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          style={{ width: '100%' }}
        >
          <XStack
            minWidth={compact ? 700 : undefined}
            paddingHorizontal="$2"
            alignItems="center"
            justifyContent="center"
            gap={roomy ? '$2' : compact ? '$1' : '$1.5'}
          >
            <ControlButton
              label={audioEnabled ? 'Mute' : 'Unmute'}
              icon={audioEnabled ? Icons.Mic : Icons.MicOff}
              variant={audioEnabled ? 'neutral' : 'danger'}
              onPress={onToggleAudio}
              compact={compact}
            />
            {caps.supportsVideo ? (
              <ControlButton
                label={videoEnabled ? 'Stop video' : 'Start video'}
                icon={videoEnabled ? Icons.Video : Icons.VideoOff}
                variant={videoEnabled ? 'neutral' : 'danger'}
                onPress={onToggleVideo}
                compact={compact}
              />
            ) : null}
            {caps.supportsScreenShare ? (
              <ControlButton
                label={screenSharing ? 'Stop share' : 'Present'}
                icon={Icons.ScreenShare}
                variant={screenSharing ? 'brand' : 'neutral'}
                onPress={onToggleScreen}
                compact={compact}
              />
            ) : null}

            <DockDivider />

            <ControlButton
              label={handRaised ? 'Lower hand' : 'Raise hand'}
              icon={Icons.Hand}
              variant={handRaised ? 'brand' : 'neutral'}
              onPress={onToggleHand}
              compact={compact}
            />
            {onToggleReactions ? (
              <ControlButton
                label="React"
                icon={Icons.Smile}
                variant={reactionTrayOpen ? 'brand' : 'neutral'}
                onPress={onToggleReactions}
                compact={compact}
              />
            ) : null}
            {caps.supportsRecording ? (
              <ControlButton
                label={recording ? 'Stop rec.' : 'Record'}
                icon={Icons.Circle}
                variant={recording ? 'danger' : 'neutral'}
                onPress={onToggleRecord}
                compact={compact}
              />
            ) : null}
            {caps.supportsLiveCaptions ? (
              <ControlButton
                label={captionsActive ? 'Hide CC' : 'Captions'}
                icon={Icons.Captions}
                variant={captionsActive ? 'brand' : 'neutral'}
                onPress={onToggleCaptions}
                compact={compact}
              />
            ) : null}
            <ControlButton
              label="Chat"
              icon={Icons.MessageSquare}
              variant={panel === 'chat' || unreadChatCount > 0 ? 'brand' : 'neutral'}
              onPress={onToggleChat}
              compact={compact}
              badgeCount={unreadChatCount}
            />
            <ControlButton
              label="Participants"
              icon={Icons.Users}
              variant={panel === 'people' || raisedHandCount > 0 ? 'brand' : 'neutral'}
              onPress={onTogglePeople}
              compact={compact}
              badgeCount={raisedHandCount}
            />
            <ControlButton
              label="Info"
              icon={Icons.Info}
              variant={panel === 'info' ? 'brand' : 'neutral'}
              onPress={onToggleInfo}
              compact={compact}
            />
            {onShare ? (
              <ControlButton
                label="Share"
                icon={Icons.Share2}
                variant="neutral"
                onPress={onShare}
                compact={compact}
              />
            ) : null}
            {isHost && onToggleInvite ? (
              <ControlButton
                label="Invite"
                icon={Icons.UserPlus}
                variant={panel === 'invite' ? 'brand' : 'neutral'}
                onPress={onToggleInvite}
                compact={compact}
              />
            ) : null}

            <DockDivider />

            {isHost && onMuteAll ? (
              <Button
                tone="outline"
                size={compact ? '$2' : '$3'}
                borderRadius={999}
                borderColor={coworkUi.borderAccent}
                color={coworkUi.brandLight}
                backgroundColor={coworkUi.brandMuted}
                onPress={onMuteAll}
              >
                Mute all
              </Button>
            ) : null}
            <Button
              tone="outline"
              size={compact ? '$2' : '$3'}
              borderRadius={999}
              borderColor="rgba(244,63,104,0.45)"
              color={coworkUi.danger}
              backgroundColor={coworkUi.dangerMuted}
              onPress={onLeave}
            >
              Leave
            </Button>
            {isHost ? (
              <Button
                tone="primary"
                size={compact ? '$2' : '$3'}
                borderRadius={999}
                backgroundColor={coworkUi.danger}
                onPress={onEnd}
                style={controlGradientStyle(coworkGradients.dangerControl, coworkUi.danger)}
              >
                End
              </Button>
            ) : null}
          </XStack>
        </ScrollView>
      </YStack>
    </YStack>
  )
}