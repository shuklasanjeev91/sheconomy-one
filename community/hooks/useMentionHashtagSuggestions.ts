import { useCallback, useEffect, useRef, useState } from 'react'

import type { ActiveToken } from '~/community/lib/mentions'
import {
  HASHTAG_SUGGEST_PAGE_SIZE,
  MENTION_SUGGEST_PAGE_SIZE,
  searchProfiles,
  suggestHashtags,
  type HashtagSuggestion,
  type ProfileSuggestion,
} from '~/community/lib/network'

export type MentionHashtagSuggestionState =
  | { kind: 'mention'; items: ProfileSuggestion[] }
  | { kind: 'hashtag'; items: HashtagSuggestion[] }
  | null

type UseMentionHashtagSuggestionsOptions = {
  token: ActiveToken | null
  enabled: boolean
  debounceMs?: number
}

export function useMentionHashtagSuggestions({
  token,
  enabled,
  debounceMs = 160,
}: UseMentionHashtagSuggestionsOptions) {
  const [results, setResults] = useState<MentionHashtagSuggestionState>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionOffset, setMentionOffset] = useState(0)
  const [hashtagLimit, setHashtagLimit] = useState(HASHTAG_SUGGEST_PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)
  const requestId = useRef(0)

  const resetPagination = useCallback(() => {
    setMentionOffset(0)
    setHashtagLimit(HASHTAG_SUGGEST_PAGE_SIZE)
    setHasMore(false)
  }, [])

  useEffect(() => {
    if (!enabled || !token) {
      setResults(null)
      setLoading(false)
      setError(null)
      resetPagination()
      return
    }

    resetPagination()
    const id = ++requestId.current
    setLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      try {
        if (token.type === 'mention') {
          const items = await searchProfiles(token.query, MENTION_SUGGEST_PAGE_SIZE, 0)
          if (id !== requestId.current) return
          setResults({ kind: 'mention', items })
          setHasMore(items.length >= MENTION_SUGGEST_PAGE_SIZE)
        } else {
          const items = await suggestHashtags(token.query, HASHTAG_SUGGEST_PAGE_SIZE)
          if (id !== requestId.current) return
          setResults({ kind: 'hashtag', items })
          setHasMore(items.length >= HASHTAG_SUGGEST_PAGE_SIZE)
        }
      } catch (fetchError) {
        if (id !== requestId.current) return
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load suggestions.')
        setResults(null)
        setHasMore(false)
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [debounceMs, enabled, resetPagination, token])

  const loadMore = useCallback(async () => {
    if (!token || loadingMore || !hasMore || !results) return

    setLoadingMore(true)
    setError(null)

    try {
      if (token.type === 'mention' && results.kind === 'mention') {
        const nextOffset = mentionOffset + MENTION_SUGGEST_PAGE_SIZE
        const items = await searchProfiles(token.query, MENTION_SUGGEST_PAGE_SIZE, nextOffset)
        setMentionOffset(nextOffset)
        setResults({
          kind: 'mention',
          items: [...results.items, ...items],
        })
        setHasMore(items.length >= MENTION_SUGGEST_PAGE_SIZE)
      } else if (token.type === 'hashtag' && results.kind === 'hashtag') {
        const nextLimit = hashtagLimit + HASHTAG_SUGGEST_PAGE_SIZE
        const items = await suggestHashtags(token.query, nextLimit)
        setHashtagLimit(nextLimit)
        setResults({ kind: 'hashtag', items })
        setHasMore(items.length >= nextLimit)
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, hashtagLimit, loadingMore, mentionOffset, results, token])

  return {
    results,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    clear: () => {
      setResults(null)
      resetPagination()
    },
  }
}
