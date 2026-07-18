import { useEffect, useRef } from 'react'
import { Animated, Easing, Platform } from 'react-native'

import { Text, YStack } from '~/components/ui'
import type { FloatingMeetingReaction } from '~/co-work/lib/meeting-reactions'
import { MEETING_REACTION_TTL_MS } from '~/co-work/lib/meeting-reactions'

type MeetingReactionsOverlayProps = {
  reactions: FloatingMeetingReaction[]
  onExpire: (id: string) => void
}

/** Floating emoji reactions that rise across the meeting stage (Meet / Zoom style). */
export function MeetingReactionsOverlay({ reactions, onExpire }: MeetingReactionsOverlayProps) {
  const overlayPosition = Platform.OS === 'web' ? ('fixed' as const) : ('absolute' as const)

  return (
    <YStack
      position={overlayPosition}
      top={0}
      left={0}
      right={0}
      bottom={120}
      pointerEvents="none"
      zIndex={40}
      overflow="hidden"
    >
      {reactions.map((reaction) => (
        <FloatingReaction key={reaction.id} reaction={reaction} onExpire={onExpire} />
      ))}
    </YStack>
  )
}

function FloatingReaction({
  reaction,
  onExpire,
}: {
  reaction: FloatingMeetingReaction
  onExpire: (id: string) => void
}) {
  const progress = useRef(new Animated.Value(0)).current
  const expiredRef = useRef(false)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: MEETING_REACTION_TTL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || expiredRef.current) return
      expiredRef.current = true
      onExpire(reaction.id)
    })
  }, [onExpire, progress, reaction.id])

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -220],
  })
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  })
  const scale = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.65, 1.15, 1],
  })

  const leftPct = 8 + (reaction.lane % 85)

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        bottom: 24,
        alignItems: 'center',
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Text fontSize={36} lineHeight={40}>
        {reaction.emoji}
      </Text>
      {reaction.name ? (
        <Text
          fontSize={10}
          fontWeight="700"
          color="rgba(255,255,255,0.85)"
          marginTop={2}
          numberOfLines={1}
        >
          {reaction.name}
        </Text>
      ) : null}
    </Animated.View>
  )
}
