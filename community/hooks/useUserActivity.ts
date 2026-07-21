import { useCallback, useEffect, useState } from 'react'

import {
  ACTIVITY_PAGE_SIZE,
  fetchUserComments,
  fetchUserPosts,
  fetchUserReactions,
  type ActivityComment,
  type ActivityFilter,
  type ActivityReaction,
} from '~/community/lib/user-activity'
import type { CommunityPost } from '~/community/lib/community'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

type ActivityItem = CommunityPost | ActivityComment | ActivityReaction

/**
 * Loads a user's activity feed (posts / comments / reactions) for the profile
 * Activity section, with tab switching and "show more" pagination.
 */
export function useUserActivity(userId?: string) {
  const [filter, setFilter] = useState<ActivityFilter>('posts')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (currentFilter: ActivityFilter, offset: number) => {
      if (!userId) return { items: [] as ActivityItem[], hasMore: false, error: null }
      if (currentFilter === 'comments') return fetchUserComments(userId, offset)
      if (currentFilter === 'reactions') return fetchUserReactions(userId, offset)
      return fetchUserPosts(userId, offset)
    },
    [userId],
  )

  useEffect(() => {
    if (!userId) {
      setItems([])
      setHasMore(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchPage(filter, 0).then((page) => {
      if (cancelled) return
      setItems(page.items)
      setHasMore(page.hasMore)
      setError(page.error)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId, filter, fetchPage])

  // Creating/editing/deleting a post refreshes profile activity in place.
  useAutoRefresh([INVALIDATION_TOPICS.userActivity, INVALIDATION_TOPICS.communityPosts], () => {
    if (!userId) return
    void fetchPage(filter, 0).then((page) => {
      setItems(page.items)
      setHasMore(page.hasMore)
      setError(page.error)
    })
  })

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const page = await fetchPage(filter, items.length)
    setItems((current) => [...current, ...page.items])
    setHasMore(page.hasMore)
    setError(page.error)
    setIsLoadingMore(false)
  }, [fetchPage, filter, hasMore, isLoading, isLoadingMore, items.length])

  return {
    filter,
    setFilter,
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    pageSize: ACTIVITY_PAGE_SIZE,
  }
}
