import { useCallback, useEffect, useState } from 'react'

import {
  fetchUserListByKind,
  USER_LIST_PAGE_SIZE,
  type UserListKind,
  type UserListMember,
} from '~/community/lib/user-lists'

export function useUserList(kind: UserListKind, userId?: string, enabled = true) {
  const [items, setItems] = useState<UserListMember[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paginated = kind === 'followers' || kind === 'following'

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!enabled || !userId) {
        setItems([])
        setIsLoading(false)
        return
      }

      if (append) setIsLoadingMore(true)
      else setIsLoading(true)

      const result = await fetchUserListByKind(kind, userId, pageToLoad)

      if (result.error) {
        setError(result.error)
        if (!append) setItems([])
        setHasMore(false)
      } else {
        setError(null)
        setItems((current) => (append ? [...current, ...result.items] : result.items))
        setPage(pageToLoad)
        setHasMore(paginated ? result.hasMore : false)
      }

      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [enabled, kind, paginated, userId],
  )

  useEffect(() => {
    setPage(0)
    loadPage(0, false)
  }, [kind, userId, loadPage])

  const loadMore = useCallback(() => {
    if (!paginated || !hasMore || isLoading || isLoadingMore) return
    loadPage(page + 1, true)
  }, [hasMore, isLoading, isLoadingMore, loadPage, page, paginated])

  const refresh = useCallback(() => {
    loadPage(0, false)
  }, [loadPage])

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    pageSize: USER_LIST_PAGE_SIZE,
  }
}
