import { useEffect, useState } from 'react'

import {
  localCommentSuggestions,
  type CommentSuggestionContext,
} from '~/community/lib/comment-suggestions'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { fetchCommentSuggestions } from '~/lib/ai'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type CommentSuggestionChipsProps = {
  context: CommentSuggestionContext
  onSelect: (text: string) => void
  disabled?: boolean
}

/**
 * Professional comment starters above the composer.
 * Shows local chips immediately, then upgrades with AI when available.
 */
export function CommentSuggestionChips({
  context,
  onSelect,
  disabled,
}: CommentSuggestionChipsProps) {
  const ui = useAppUi()
  const { user } = useSupabase()
  const [suggestions, setSuggestions] = useState(() => localCommentSuggestions(context))
  const [loadingAi, setLoadingAi] = useState(false)

  useEffect(() => {
    setSuggestions(localCommentSuggestions(context))
  }, [
    context.postType,
    context.content,
    context.authorName,
    context.eventTitle,
    context.celebrationTitle,
    context.productTitle,
    context.shopName,
    context.articleTitle,
    context.hasMedia,
  ])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoadingAi(true)
    void fetchCommentSuggestions(context)
      .then((rows) => {
        if (!cancelled && rows.length > 0) setSuggestions(rows.slice(0, 4))
      })
      .catch(() => {
        // Keep local chips when AI is unavailable (quota, offline, etc.)
      })
      .finally(() => {
        if (!cancelled) setLoadingAi(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, context.postType, context.content, context.authorName])

  if (!suggestions.length) return null

  return (
    <YStack gap="$1.5">
      <XStack alignItems="center" gap="$1.5" paddingHorizontal="$0.5">
        <Icons.Sparkles size={12} color={ui.brand} />
        <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
          Suggested comments
        </Text>
        {loadingAi ? <Spinner size="small" /> : null}
      </XStack>
      <HorizontalScrollRow gap="$2">
        {suggestions.map((text) => (
          <Text
            key={text}
            onPress={() => {
              if (disabled) return
              onSelect(text)
            }}
            fontSize={12}
            color={ui.text}
            numberOfLines={2}
            maxWidth={220}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={999}
            borderWidth={1}
            borderColor={ui.border}
            backgroundColor={ui.surface}
            cursor={disabled ? 'default' : 'pointer'}
            opacity={disabled ? 0.55 : 1}
            hoverStyle={disabled ? undefined : { borderColor: ui.brand, backgroundColor: ui.chip }}
          >
            {text}
          </Text>
        ))}
      </HorizontalScrollRow>
    </YStack>
  )
}
