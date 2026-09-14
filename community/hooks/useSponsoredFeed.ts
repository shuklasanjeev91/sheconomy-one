import { useCallback, useEffect, useState } from 'react'

import {
  fetchSponsoredFeedItems,
  type SponsoredFeedItem,
} from '~/community/lib/sponsored-ads'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useSponsoredFeed(enabled = true) {
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<SponsoredFeedItem[]>([])

  const refresh = useCallback(async () => {
    if (!enabled || !user) {
      setItems([])
      return
    }
    const result = await fetchSponsoredFeedItems(2)
    if (result.data) setItems(result.data)
  }, [enabled, user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  return { items, refresh }
}
