import { useRef, useState } from 'react'

import { ReactionBurst, ReactionPicker } from '~/community/components/ReactionPicker'
import { REACTION_TYPES, type ReactionType } from '~/community/lib/constants'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Icons, Text, XStack, useMedia } from '~/components/ui'

type PostLikeButtonProps = {
  isLiked: boolean
  reactionType: string | null
  reactionLabel: string
  isAuthenticated: boolean
  isReacting: boolean
  onQuickLike: () => void
  onPickReaction: (type: ReactionType) => void
  onRequireAuth: () => void
}

export function PostLikeButton({
  isLiked,
  reactionType,
  reactionLabel,
  isAuthenticated,
  isReacting,
  onQuickLike,
  onPickReaction,
  onRequireAuth,
}: PostLikeButtonProps) {
  const communityUi = useCommunityUi()
  const media = useMedia()
  const isDesktop = media.gtMd
  const [pickerOpen, setPickerOpen] = useState(false)
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeReaction = REACTION_TYPES.find((item) => item.type === reactionType)
  const color = isLiked ? (activeReaction?.color ?? communityUi.brand) : communityUi.textMuted
  const Icon = isLiked && reactionType === 'like' ? Icons.ThumbsUp : Icons.ThumbsUp

  function openPicker() {
    if (!isAuthenticated) {
      onRequireAuth()
      return
    }
    setPickerOpen(true)
  }

  function handlePress() {
    if (!isAuthenticated) {
      onRequireAuth()
      return
    }
    onQuickLike()
  }

  function handlePressIn() {
    if (!isAuthenticated) return
    longPressTimer.current = setTimeout(() => {
      setPickerOpen(true)
    }, 400)
  }

  function handlePressOut() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleSelect(type: ReactionType) {
    const emoji = REACTION_TYPES.find((item) => item.type === type)?.emoji ?? '👍'
    setBurstEmoji(emoji)
    onPickReaction(type)
    setPickerOpen(false)
  }

  return (
    <XStack
      flex={1}
      flexShrink={1}
      minWidth={0}
      position="relative"
      alignItems="center"
      justifyContent="center"
      // @ts-expect-error web hover
      onMouseEnter={isDesktop && isAuthenticated ? () => setPickerOpen(true) : undefined}
    >
      {burstEmoji ? (
        <ReactionBurst emoji={burstEmoji} onDone={() => setBurstEmoji(null)} />
      ) : null}

      <ReactionPicker
        visible={pickerOpen}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />

      <XStack
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap={2}
        paddingVertical={10}
        paddingHorizontal={2}
        borderRadius={4}
        flex={1}
        flexShrink={1}
        minWidth={0}
        opacity={isReacting ? 0.6 : 1}
        cursor="pointer"
        hoverStyle={{ backgroundColor: communityUi.divider }}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        // @ts-expect-error web - double click opens picker on desktop
        onDoubleClick={isDesktop ? openPicker : undefined}
      >
        {isLiked && reactionType && reactionType !== 'like' ? (
          <Text fontSize={18}>{activeReaction?.emoji}</Text>
        ) : (
          <Icon size={20} color={color} fill={isLiked ? color : 'transparent'} />
        )}
        <Text
          fontSize={11}
          fontWeight="600"
          color={color}
          numberOfLines={1}
          textAlign="center"
        >
          {isLiked ? reactionLabel : 'Like'}
        </Text>
      </XStack>
    </XStack>
  )
}