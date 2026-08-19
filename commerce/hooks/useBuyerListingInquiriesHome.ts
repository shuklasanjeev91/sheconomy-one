import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildBuyerListingInquiryCards,
  fetchBuyerListingInquiries,
  type BuyerListingInquiryCard,
} from '~/commerce/lib/buyer-listing-inquiries-home'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useBuyerListingInquiriesHome(limit = 5) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cards, setCards] = useState<BuyerListingInquiryCard[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const rows = await fetchBuyerListingInquiries(user.id)
    setCards(buildBuyerListingInquiryCards(rows, limit))
    setLoading(false)
  }, [limit, user?.id])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useAutoRefresh([INVALIDATION_TOPICS.commerceInquiries], () => {
    if (authLoading) return
    void reload()
  })

  return useMemo(
    () => ({
      cards,
      loading: authLoading || loading,
      hasCards: cards.length > 0,
      refresh: reload,
    }),
    [authLoading, cards, loading, reload],
  )
}

export type { BuyerListingInquiryCard }
