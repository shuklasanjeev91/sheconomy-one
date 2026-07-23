import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatPollPayload, PollResult } from '~/chat/lib/types'
import { Icons, Text, XStack, YStack } from '~/components/ui'

type PollMessageProps = {
  poll: ChatPollPayload
  result?: PollResult
  isOwn: boolean
  onVote: (optionIndex: number) => void
}

/** WhatsApp-style poll bubble: question, tappable options, live vote bars. */
export function PollMessage({ poll, result, isOwn, onVote }: PollMessageProps) {
  const chat = useChatTheme()
  // Legacy polls carry pre-counted votes in `baseCounts`; add live votes on top.
  const base = poll.baseCounts ?? []
  const live = result?.counts ?? []
  const counts = poll.options.map((_, index) => (live[index] ?? 0) + (base[index] ?? 0))
  const total = counts.reduce((sum, value) => sum + value, 0)
  const myOptionIndex = result?.myOptionIndex ?? null
  const canVote = typeof onVote === 'function'

  const questionColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const metaColor = isOwn ? chat.bubbleMetaOut : chat.bubbleMetaIn
  const trackColor = isOwn ? 'rgba(255,255,255,0.18)' : chat.divider
  const fillColor = chat.brand

  return (
    <YStack gap={8} minWidth={210} paddingVertical={2}>
      <XStack alignItems="center" gap={6}>
        <Icons.BarChart2 size={15} color={metaColor} />
        <Text fontSize={15} fontWeight="700" color={questionColor} flex={1}>
          {poll.question}
        </Text>
      </XStack>

      <YStack gap={7}>
        {poll.options.map((option, index) => {
          const votes = counts[index] ?? 0
          const percent = total > 0 ? Math.round((votes / total) * 100) : 0
          const isMine = myOptionIndex === index
          return (
            <YStack
              key={index}
              onPress={canVote ? () => onVote(index) : undefined}
              cursor={canVote ? 'pointer' : 'default'}
              borderRadius={8}
              borderWidth={1}
              borderColor={isMine ? fillColor : chat.border}
              overflow="hidden"
              position="relative"
              minHeight={36}
              justifyContent="center"
              pressStyle={canVote ? { opacity: 0.85 } : undefined}
              accessibilityRole="button"
              accessibilityState={{ selected: isMine }}
            >
              <YStack
                position="absolute"
                top={0}
                left={0}
                bottom={0}
                width={`${Math.max(2, percent)}%`}
                backgroundColor={isMine ? chat.reactionMineBg : trackColor}
              />
              <XStack paddingHorizontal={10} paddingVertical={7} alignItems="center" gap={8}>
                <XStack
                  width={18}
                  height={18}
                  borderRadius={999}
                  borderWidth={2}
                  borderColor={isMine ? fillColor : metaColor}
                  backgroundColor={isMine ? fillColor : 'transparent'}
                  alignItems="center"
                  justifyContent="center"
                >
                  {isMine ? <Icons.Check size={11} color={chat.brandContrast} /> : null}
                </XStack>
                <Text flex={1} fontSize={14} fontWeight={isMine ? '700' : '500'} color={questionColor}>
                  {option}
                </Text>
                <Text fontSize={12.5} fontWeight="600" color={metaColor}>
                  {percent}%
                </Text>
              </XStack>
            </YStack>
          )
        })}
      </YStack>

      <Text fontSize={11.5} color={metaColor}>
        {total} {total === 1 ? 'vote' : 'votes'} · Tap to vote
      </Text>
    </YStack>
  )
}
