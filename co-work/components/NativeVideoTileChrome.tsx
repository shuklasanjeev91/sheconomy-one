import type { ReactNode } from 'react'
import { Alert, Platform } from 'react-native'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  useMeetingLiveSignals,
  useParticipantHandRaised,
  useParticipantMeetingRole,
  useParticipantNonverbal,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingRoleBadge } from '~/co-work/components/MeetingRoleBadge'
import { meetingNonverbalEmoji } from '~/co-work/lib/meeting-nonverbal'
import { meetingTileActionLabel, meetingTileMenuActions } from '~/co-work/lib/meeting-tile-actions'
import { useCoWorkTheme } from '~/co-work/lib/theme'

/** Size and emphasis every native stage tile receives, independent of the SFU. */
export type NativeStageTileProps<T> = {
  trackRef: T
  name: string
  isScreen: boolean
  width: number
  height: number
  radius: number
  compact?: boolean
  /** Overlaps another video tile; Android needs the media-overlay surface layer to stay on top. */
  floating?: boolean
  mirrorLocalVideo: boolean
  hdVideo?: boolean
  activeSpeaker: boolean
  /** Local share is on. SurfaceViews punch a black hole into MediaProjection. */
  localScreenShareActive?: boolean
  onOpenProfile?: () => void
}

/**
 * Native tile frame: border, avatar placeholder, badges, name chip and the
 * long-press menu. `video` replaces the placeholder when present.
 */
export function NativeVideoTileChrome({
  identity,
  name,
  avatarUrl,
  isScreen,
  micMuted,
  stopRemoteCamera,
  connecting = false,
  screenPlaceholder,
  width,
  height,
  radius,
  compact,
  activeSpeaker,
  video,
  onSurfaceLayout,
  onOpenProfile,
}: {
  identity: string
  name: string
  avatarUrl: string | null
  isScreen: boolean
  micMuted: boolean
  stopRemoteCamera: boolean
  /** In the meeting but not on the media server yet. */
  connecting?: boolean
  /** Text shown instead of the avatar (screen share / local surface hidden). */
  screenPlaceholder: string | null
  width: number
  height: number
  radius: number
  compact?: boolean
  activeSpeaker: boolean
  video: ReactNode | null
  onSurfaceLayout: (width: number, height: number) => void
  onOpenProfile?: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const {
    localUserId,
    spotlightUserId,
    pinnedUserIds,
    togglePinnedUserId,
    tileHostActions,
    triggerStageTap,
  } = useMeetingLiveSignals()
  const handRaised = useParticipantHandRaised(identity)
  const nonverbal = useParticipantNonverbal(identity)
  const meetingRole = useParticipantMeetingRole(identity)
  const isSelf = identity === localUserId
  const isPinned = pinnedUserIds.includes(identity)
  const isSpotlighted = spotlightUserId === identity

  const openTileMenu = () => {
    const actions = meetingTileMenuActions({
      isSelf,
      isScreen,
      canModerate: !!tileHostActions?.canModerate,
      isPinned,
      isSpotlighted,
      handRaised,
      canViewProfile: !!onOpenProfile,
    })
    if (actions.length === 0) return
    Alert.alert(
      name,
      undefined,
      [
        ...actions.map((action) => ({
          text: meetingTileActionLabel(action),
          onPress: () => {
            if (action === 'view_profile') {
              onOpenProfile?.()
              return
            }
            if (action === 'pin' || action === 'unpin') {
              togglePinnedUserId(identity)
              return
            }
            if (action === 'spotlight') {
              tileHostActions?.setSpotlight(identity)
              return
            }
            if (action === 'remove_spotlight') {
              tileHostActions?.setSpotlight(null)
              return
            }
            if (action === 'lower_hand') {
              tileHostActions?.lowerHandFor(identity)
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true },
    )
  }

  return (
    <Pressable
      onPress={triggerStageTap}
      onLongPress={openTileMenu}
      delayLongPress={420}
      style={{ width, height, maxWidth: '100%' }}
    >
    <YStack
      width="100%"
      height="100%"
      maxWidth="100%"
      borderRadius={radius}
      overflow="hidden"
      // Keep border width constant — toggling 1↔2 on speak remounted Android video.
      borderWidth={2}
      borderColor={
        (handRaised || activeSpeaker || isSpotlighted || isPinned) && !isScreen
          ? coworkUi.brand
          : coworkUi.tileBorder
      }
      backgroundColor={coworkUi.tileBg}
      position="relative"
      collapsable={false}
      onLayout={(event) => {
        const { width: layoutW, height: layoutH } = event.nativeEvent.layout
        if (layoutW > 1 && layoutH > 1) onSurfaceLayout(layoutW, layoutH)
      }}
    >
      {video ?? (
        <YStack flex={1} width="100%" height="100%" alignItems="center" justifyContent="center" gap={compact ? 4 : 8}>
          {screenPlaceholder ? (
            <Text fontSize={compact ? 11 : 13} color={coworkUi.textSecondary} fontWeight="600" textAlign="center" paddingHorizontal="$3">
              {screenPlaceholder}
            </Text>
          ) : (
            <>
              <Avatar name={name} src={avatarUrl ?? undefined} size={compact ? '$5' : '$8'} />
              {/* Short tiles have no room between the avatar and the name pill. */}
              {!compact && height >= 180 ? (
                <Text fontSize={12} color={coworkUi.textMuted} fontWeight="600">
                  {connecting ? 'Connecting…' : stopRemoteCamera ? 'Video paused' : 'Camera off'}
                </Text>
              ) : null}
            </>
          )}
        </YStack>
      )}
      {handRaised && !isScreen ? (
        <YStack
          position="absolute"
          top={compact ? 6 : 10}
          right={compact ? 6 : 10}
          width={compact ? 28 : 34}
          height={compact ? 28 : 34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(12, 8, 10, 0.78)"
          borderWidth={1}
          borderColor={coworkUi.brandLight}
          zIndex={4}
        >
          <Text fontSize={compact ? 14 : 16}>✋</Text>
        </YStack>
      ) : null}
      {!isScreen && (isPinned || isSpotlighted) ? (
        <XStack
          position="absolute"
          top={compact ? 6 : 10}
          alignSelf="center"
          gap={6}
          zIndex={5}
          pointerEvents="none"
        >
          {isSpotlighted ? (
            <YStack
              width={compact ? 26 : 30}
              height={compact ? 26 : 30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(12, 8, 10, 0.82)"
              borderWidth={1}
              borderColor="rgba(245,197,66,0.55)"
            >
              <Text fontSize={compact ? 12 : 14} color="#F5C542">
                ★
              </Text>
            </YStack>
          ) : null}
          {isPinned ? (
            <YStack
              width={compact ? 26 : 30}
              height={compact ? 26 : 30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(12, 8, 10, 0.82)"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.22)"
            >
              <Text fontSize={compact ? 11 : 13}>📌</Text>
            </YStack>
          ) : null}
        </XStack>
      ) : null}
      {nonverbal && !isScreen ? (
        <YStack
          position="absolute"
          top={compact ? 6 : 10}
          left={compact ? 6 : 10}
          width={compact ? 28 : 34}
          height={compact ? 28 : 34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(12, 8, 10, 0.78)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.22)"
          zIndex={4}
        >
          <Text fontSize={compact ? 13 : 15}>{meetingNonverbalEmoji(nonverbal)}</Text>
        </YStack>
      ) : null}
      {!isScreen && (meetingRole === 'host' || meetingRole === 'co_host') && !compact && !nonverbal ? (
        <YStack position="absolute" top={10} left={10} zIndex={5}>
          <MeetingRoleBadge role={meetingRole} size="sm" />
        </YStack>
      ) : null}
      {/* elevation keeps the name chip above Android SurfaceView video */}
      <YStack
        position="absolute"
        left={compact ? 6 : 10}
        bottom={compact ? 6 : 10}
        paddingHorizontal={compact ? 8 : 12}
        paddingVertical={compact ? 3 : 5}
        borderRadius={999}
        backgroundColor="rgba(12, 8, 10, 0.82)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.18)"
        maxWidth="90%"
        zIndex={8}
        elevation={Platform.OS === 'android' ? 8 : undefined}
        pointerEvents="none"
        collapsable={false}
        renderToHardwareTextureAndroid
      >
        <XStack alignItems="center" gap={6} maxWidth="100%">
          {micMuted ? <Icons.MicOff size={compact ? 11 : 13} color="#fda4af" /> : null}
          <Text fontSize={compact ? 10 : 12} fontWeight="700" color="#fff" numberOfLines={1} flexShrink={1}>
            {name}
            {isScreen ? ' · Screen' : ''}
            {handRaised && !isScreen ? ' · ✋' : ''}
          </Text>
        </XStack>
      </YStack>
    </YStack>
    </Pressable>
  )
}
