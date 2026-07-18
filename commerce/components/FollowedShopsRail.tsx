import { useCallback, useEffect, useState } from 'react'

import { ShopSpotlightCard } from '~/commerce/components/ShopSpotlightCard'
import type { ShopSummary } from '~/commerce/lib/commerce'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { getFollowedShops } from '~/lib/shop/shop.service'
import type { Shop } from '~/lib/shop/shop.type'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type FollowedShopsRailProps = {
  inset?: boolean
}

function toShopSummary(shop: Shop): ShopSummary {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    slug: shop.slug,
    logo_url: shop.logo_url,
    verified: shop.verified,
    rating: shop.rating,
    review_count: shop.review_count,
    shop_categories: shop.shop_categories,
    is_active: shop.is_active,
  } as ShopSummary
}

/** Home rail — shops the signed-in user follows. Hidden when empty. */
export function FollowedShopsRail({ inset }: FollowedShopsRailProps) {
  const ui = useAppUi()
  const { shops, isLoading, user } = useFollowedShopsList()

  if (!user || isLoading) return null
  if (!shops.length) return null

  return (
    <YStack gap="$3" paddingHorizontal={inset ? '$4' : 0} paddingVertical="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={18} fontWeight="700" color={ui.text}>
          Shops you follow
        </Text>
        <AppLink href={commerceRoutes.following}>
          <Text fontSize={13} color={ui.brand} fontWeight="600">
            See all
          </Text>
        </AppLink>
      </XStack>
      <XStack gap="$3" flexWrap="wrap">
        {shops.slice(0, 6).map((shop) => (
          <ShopSpotlightCard key={shop.id} shop={toShopSummary(shop)} />
        ))}
      </XStack>
    </YStack>
  )
}

export function useFollowedShopsList() {
  const { user } = useSupabase()
  const [shops, setShops] = useState<Shop[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setShops([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const result = await getFollowedShops(user.id)
    setShops(result.data ?? [])
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  return { shops, isLoading, reload, user }
}
