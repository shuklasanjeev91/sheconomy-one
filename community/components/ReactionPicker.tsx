import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'

import { REACTION_TYPES, type ReactionType } from '~/community/lib/constants'
import { useCommunityUi } from '~/community/lib/community-theme'
import { WebOnlyStyle } from '~/components/platform/WebOnlyStyle'
import { Text, XStack, YStack } from '~/components/ui'

type ReactionPickerProps = {
  visible: boolean
  onSelect: (type: ReactionType) => void
  onClose: () => void
}

/** Floating reaction bar with pop-in animation. */
export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  const communityUi = useCommunityUi()
  if (!visible) return null

  const bar = (
    <XStack
      backgroundColor={communityUi.cardBg}
      borderRadius={999}
      paddingHorizontal={10}
      paddingVertical={8}
      gap={4}
      borderWidth={1}
      borderColor={communityUi.borderLight}
      alignItems="center"
      style={Platform.OS === 'web' ? { boxShadow: communityUi.reactionBarShadow } : undefined}
      // @ts-expect-error web pointer events
      onMouseLeave={Platform.OS === 'web' ? onClose : undefined}
    >
      {REACTION_TYPES.map((reaction, index) => (
        <ReactionEmoji
          key={reaction.type}
          emoji={reaction.emoji}
          label={reaction.label}
          delayMs={index * 45}
          onPress={() => {
            onSelect(reaction.type)
            onClose()
          }}
        />
      ))}
    </XStack>
  )

  // Native: Modal so the bar isn't clipped by CommunityCard / overflow parents.
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss reactions" />
          <View style={styles.modalBar} pointerEvents="box-none">
            {bar}
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <>
      <YStack
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={98}
        onPress={onClose}
        cursor="default"
      />
      <XStack
        position="absolute"
        bottom={'calc(100% + 8px)' as unknown as number}
        left={0}
        zIndex={99}
      >
        {bar}
      </XStack>
    </>
  )
}

function ReactionEmoji({
  emoji,
  label,
  delayMs,
  onPress,
}: {
  emoji: string
  label: string
  delayMs: number
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      width={44}
      height={44}
      borderRadius={999}
      cursor="pointer"
      hoverStyle={{ transform: [{ scale: 1.35 }] }}
      onPress={onPress}
      opacity={mounted ? 1 : 0}
      transform={mounted ? [{ scale: 1 }, { translateY: 0 }] : [{ scale: 0.3 }, { translateY: 12 }]}
      style={
        Platform.OS === 'web'
          ? {
              transition: `transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease`,
            }
          : undefined
      }
    >
      <Text fontSize={28} lineHeight={32}>
        {emoji}
      </Text>
      <Text
        position="absolute"
        bottom={-18}
        fontSize={10}
        fontWeight="600"
        color={communityUi.textMuted}
        opacity={0}
        style={Platform.OS === 'web' ? { transition: 'opacity 0.15s' } : undefined}
        // @ts-expect-error web
        className="reaction-label"
      >
        {label}
      </Text>
    </YStack>
  )
}

export function ReactionBurst({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 700)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <YStack
      position="absolute"
      top={-20}
      left={0}
      right={0}
      alignItems="center"
      zIndex={100}
      pointerEvents="none"
      opacity={1}
      style={
        Platform.OS === 'web'
          ? {
              animation: 'reactionBurst 0.7s ease forwards',
            }
          : undefined
      }
    >
      <Text fontSize={40}>{emoji}</Text>
      <WebOnlyStyle>{`
        @keyframes reactionBurst {
          0% { transform: scale(0.5); opacity: 1; }
          50% { transform: scale(1.4) translateY(-24px); opacity: 1; }
          100% { transform: scale(1) translateY(-40px); opacity: 0; }
        }
      `}</WebOnlyStyle>
    </YStack>
  )
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 96,
  },
  modalBar: {
    alignItems: 'center',
    zIndex: 2,
  },
})
