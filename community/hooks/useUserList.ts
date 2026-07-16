import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchUserListByKind,
  USER_LIST_PAGE_SIZE,
  type UserListKind,
  type UserListMember,
} from '~/community/lib/user-lists'

export function useUserList(kind: UserListKind, userId?: string, enabled = true) {
  const [items, setItems] = useState<UserListMember[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const paginated = kind === 'followers' || kind === 'following'

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!enabled || !userId) {
        setItems([])
        setTotalCount(0)
        setIsLoading(false)
        return
      }

      const requestId = ++requestIdRef.current
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)

      const result = await fetchUserListByKind(kind, userId, pageToLoad)
      if (requestId !== requestIdRef.current) return

      if (result.error) {
        setError(result.error)
        if (!append) {
          setItems([])
          setTotalCount(0)
        }
        setHasMore(false)
      } else {
        setError(null)
        setItems((current) => {
          const next = append ? [...current, ...result.items] : result.items
          // Always unique by user id so list length never exceeds real people.
          const byId = new Map(next.map((item) => [item.user_id, item]))
          return Array.from(byId.values())
        })
        setTotalCount(result.totalCount)
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
    setItems([])
    setTotalCount(0)
    void loadPage(0, false)
  }, [kind, userId, loadPage])

  const loadMore = useCallback(() => {
    if (!paginated || !hasMore || isLoading || isLoadingMore) return
    void loadPage(page + 1, true)
  }, [hasMore, isLoading, isLoadingMore, loadPage, page, paginated])

  const refresh = useCallback(() => {
    void loadPage(0, false)
  }, [loadPage])

  return {
    items,
    totalCount,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    pageSize: USER_LIST_PAGE_SIZE,
  }
}
