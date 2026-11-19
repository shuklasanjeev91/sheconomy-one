import { useEffect, useMemo, useState } from 'react'

import {
  commentSuggestionContextKey,
  localCommentSuggestions,
  type CommentSuggestionContext,
} from '~/community/lib/comment-suggestions'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { draftCommentWithAi, fetchCommentSuggestions } from '~/lib/ai'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type CommentSuggestionChipsProps = {
  context: CommentSuggestionContext
  onSelect: (text: string) => void
  disabled?: boolean
  /** Current comment box text — SHERPA expands or polishes this. */
  seedPrompt?: string
}

const AI_SUGGESTION_TIMEOUT_MS = 8000
const aiSuggestionCache = new Map<string, string[]>()

function withSuggestionTimeout<T>(promise: Promise<T>, timeoutMs = AI_SUGGESTION_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs)
    }),
  ])
}

/**
 * SHERPA comment assist — Write with SHERPA + suggestion chips for add-comment / reply.
 */
export function CommentSuggestionChips({
  context,
  onSelect,
  disabled,
  seedPrompt = '',
}: CommentSuggestionChipsProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const contextKey = useMemo(() => commentSuggestionContextKey(context), [context])
  const stableContext = useMemo(() => ({ ...context }), [contextKey])
  const localRows = useMemo(() => localCommentSuggestions(stableContext).slice(0, 4), [contextKey])
  const [suggestions, setSuggestions] = useState<string[]>(localRows)
  const [loadingAi, setLoadingAi] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const seed = seedPrompt.trim()

  useEffect(() => {
    setSuggestions(localRows)
  }, [contextKey, localRows])

  useEffect(() => {
    if (!user) {
      setSuggestions(localRows)
      setLoadingAi(false)
      return
    }
    const cached = aiSuggestionCache.get(contextKey)
    if (cached?.length) {
      setSuggestions(cached)
      setLoadingAi(false)
      return
    }

    let cancelled = false
    setLoadingAi(true)
    void withSuggestionTimeout(fetchCommentSuggestions(stableContext), AI_SUGGESTION_TIMEOUT_MS)
      .then((rows) => {
        if (cancelled) return
        const next = (rows ?? []).map((row) => row.trim()).filter(Boolean).slice(0, 6)
        if (!next.length) return
        aiSuggestionCache.set(contextKey, next)
        setSuggestions(next)
      })
      .catch(() => {
        // Keep local starters visible.
      })
      .finally(() => {
        if (!cancelled) setLoadingAi(false)
      })
    return () => {
      cancelled = true
    }
  }, [contextKey, localRows, stableContext, user])

  async function writeWithSherpa() {
    if (drafting || disabled) return
    setDrafting(true)
    try {
      const result = await draftCommentWithAi({
        ...stableContext,
        prompt: seed || null,
      })
      const content = result.content.trim()
      if (!content) {
        toast.show('Couldn’t draft this comment', {
          tone: 'error',
          message: 'SHERPA couldn’t write a comment. Try again.',
        })
        return
      }
      onSelect(content)
      toast.show('Comment ready', {
        tone: 'success',
        message: seed
          ? 'SHERPA polished your note into a comment.'
          : 'SHERPA drafted a comment for this post.',
      })
    } catch (err) {
      toast.show('Couldn’t draft this comment', {
        tone: 'error',
        message:
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'SHERPA couldn’t write a comment. Try again.',
      })
    } finally {
      setDrafting(false)
    }
  }

  const chips = suggestions.length ? suggestions : localRows
  if (!chips.length && !user) return null

  return (
    <YStack gap="$1.5">
      <XStack alignItems="center" gap="$2" paddingHorizontal="$0.5" flexWrap="wrap">
        <XStack
          alignItems="center"
          gap={6}
          cursor={drafting || disabled ? 'default' : 'pointer'}
          opacity={drafting || disabled ? 0.65 : 1}
          pressStyle={drafting || disabled ? undefined : { opacity: 0.85 }}
          onPress={() => {
            if (!drafting && !disabled) void writeWithSherpa()
          }}
          accessibilityRole="button"
          accessibilityLabel="Write with SHERPA"
          accessibilityState={{ disabled: drafting || Boolean(disabled) }}
        >
          {drafting ? (
            <Spinner size="small" color={ui.brand} />
          ) : (
            <Icons.Sparkles size={12} color={ui.brand} />
          )}
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            {drafting ? 'SHERPA is writing…' : 'Write with SHERPA'}
          </Text>
        </XStack>
        {loadingAi ? <Spinner size="small" /> : null}
      </XStack>
      {chips.length ? (
        <HorizontalScrollRow gap="$2">
          {chips.map((text) => (
            <Text
              key={text}
              onPress={() => {
                if (disabled || drafting) return
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
              cursor={disabled || drafting ? 'default' : 'pointer'}
              opacity={disabled || drafting ? 0.55 : 1}
              hoverStyle={
                disabled || drafting ? undefined : { borderColor: ui.brand, backgroundColor: ui.chip }
              }
            >
              {text}
            </Text>
          ))}
        </HorizontalScrollRow>
      ) : null}
    </YStack>
  )
}
