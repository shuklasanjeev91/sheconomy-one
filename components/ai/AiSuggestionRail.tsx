import { useRouter } from 'one'
import { useEffect, useState } from 'react'

import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { HorizontalScrollRow } from '~/components/layout'
import { radius } from '~/config/tokens'
import {
  aiProductLabel,
  fetchAiSuggestions,
  localAiSuggestionChips,
  sendAiSuggestionFeedback,
  type AiContext,
  type AiProduct,
  type AiSuggestion,
} from '~/lib/ai'
import { helpHref } from '~/lib/help/types'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'
import { useSupabase } from '~/providers/SupabaseProvider'

type AiSuggestionRailProps = {
  product: AiProduct
  contextPage?: string
  title?: string
  /** Entity context passed into the assistant when a chip is tapped. */
  context?: AiContext
  /** When set, wraps chips with horizontal page inset padding. */
  inset?: boolean
}

/**
 * Compact horizontal suggestion chips for product homes / PDP.
 * Tapping a chip opens the shared AI sheet with that prompt.
 */
export function AiSuggestionRail({
  product,
  contextPage = 'home',
  title = 'Ask SHEconomy AI',
  context,
  inset = false,
}: AiSuggestionRailProps) {
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useSupabase()
  const ai = useAiAssistOptional()
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchAiSuggestions({ product, contextPage })
      .then((rows) => {
        if (cancelled) return
        if (rows.length > 0) {
          setSuggestions(rows)
          return
        }
        // Local chips so every tab stays useful when DB/edge is empty or quota-limited.
        setSuggestions(localAiSuggestionChips(product, contextPage))
      })
      .catch(() => {
        if (!cancelled) setSuggestions(localAiSuggestionChips(product, contextPage))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, product, contextPage])

  if (!user) return null
  if (!loading && suggestions.length === 0) return null

  function onChip(suggestion: AiSuggestion) {
    if (!suggestion.id.startsWith('local-')) {
      void sendAiSuggestionFeedback({ suggestionId: suggestion.id, helpful: true }).catch(() => {})
    }
    if (ai) {
      ai.openAssist({
        product,
        contextPage,
        context,
        prompt: suggestion.suggestion_action || suggestion.suggestion_text,
        autoSend: true,
      })
      return
    }
    router.push(helpHref(product === 'account' ? '' : product) as never)
  }

  const content = (
    <YStack gap="$2" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Icons.Sparkles size={16} color={ui.brand} />
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
            {title}
          </Text>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            {aiProductLabel(product)}
          </Text>
        </XStack>
        {ai ? (
          <Text
            fontSize={12}
            fontWeight="600"
            color={ui.brand}
            cursor="pointer"
            onPress={() => ai.openAssist({ product, contextPage, context })}
          >
            Open
          </Text>
        ) : null}
      </XStack>

      {loading && suggestions.length === 0 ? (
        <XStack paddingVertical="$2">
          <Spinner size="small" color={ui.brand} />
        </XStack>
      ) : (
        <HorizontalScrollRow gap="$2">
          {suggestions.map((suggestion) => (
            <XStack
              key={suggestion.id}
              paddingHorizontal={14}
              paddingVertical={9}
              borderRadius={radius.pill}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              alignItems="center"
              gap={6}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover }}
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onChip(suggestion)}
            >
              <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                {suggestion.suggestion_text}
              </Text>
            </XStack>
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )

  if (inset) {
    return (
      <YStack width="100%" paddingHorizontal="$4" paddingVertical="$1">
        {content}
      </YStack>
    )
  }

  return content
}
