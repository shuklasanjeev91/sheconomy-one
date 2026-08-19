import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildCreateShopHomeCard,
  type CreateShopHomeCard,
} from '~/commerce/lib/create-shop-home'
import { useAccess } from '~/hooks/useAccess'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useSupabase } from '~/providers/SupabaseProvider'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'

export function useCreateShopHome() {
  const { user, isLoading: authLoading } = useSupabase()
  const { canManageShops } = useAccess()
  const { shops, isLoading: shopsLoading } = useVendorShops()
  const [card, setCard] = useState<CreateShopHomeCard | null>(null)

  const reload = useCallback(() => {
    setCard(
      buildCreateShopHomeCard({
        isAuthenticated: Boolean(user?.id),
        canManageShops,
        hasShops: shops.length > 0,
      }),
    )
  }, [canManageShops, shops.length, user?.id])

  useEffect(() => {
    if (authLoading || shopsLoading) return
    reload()
  }, [authLoading, reload, shopsLoading])

  useAutoRefresh([INVALIDATION_TOPICS.commerceShops], () => {
    if (authLoading || shopsLoading) return
    reload()
  })

  return useMemo(
    () => ({
      card,
      loading: authLoading || shopsLoading,
      hasCard: card != null,
      refresh: reload,
    }),
    [authLoading, card, reload, shopsLoading],
  )
}

export type { CreateShopHomeCard }
