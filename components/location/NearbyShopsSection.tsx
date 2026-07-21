import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import {
  fetchNearbyShops,
  useOptionalUserLocation,
  type NearbyShop,
} from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'
import { getShopSlug } from '~/lib/supabase/commerce'

type NearbyShopsSectionProps = {
  maxDistanceKm?: number
  title?: string
}

/** “Near you” shop discovery using shared user location + get_nearby_shops_with_ratings. */
export function NearbyShopsSection({
  maxDistanceKm = 80,
  title = 'Shops near you',
}: NearbyShopsSectionProps) {
  const ui = useAppUi()
  const location = useOptionalUserLocation()
  const [shops, setShops] = useState<NearbyShop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const latitude = location?.latitude ?? null
  const longitude = location?.longitude ?? null
  const locationReady = location?.status === 'ready' || location?.status === 'denied' || location?.status === 'unavailable'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (latitude == null || longitude == null) {
        if (locationReady || !location) {
          setLoading(false)
          setShops([])
          setError(null)
        }
        return
      }

      setLoading(true)
      const result = await fetchNearbyShops(
        { latitude, longitude },
        { maxDistanceKm },
      )
      if (cancelled) return
      setShops(result.shops)
      setError(result.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [latitude, longitude, maxDistanceKm, locationReady, location])

  if (loading || !shops.length) return null

  return (
    <YStack gap="$3" width="100%" paddingHorizontal="$4" paddingVertical="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.3}>
          {title}
        </Text>
        <AppLink href={commerceRoutes.shops}>
          <Text fontSize={13} fontWeight="600" color={ui.link}>
            See all shops
          </Text>
        </AppLink>
      </XStack>

      {error ? (
        <Text fontSize={13} color={ui.textMuted}>
          {error}
        </Text>
      ) : null}

      <YStack gap="$2">
        {shops.slice(0, 6).map((shop) => (
          <AppLink
            key={shop.id}
            href={commerceRoutes.shop(
              getShopSlug({ id: shop.id, shop_name: shop.shop_name }),
            )}
            asChild
          >
            <XStack
              alignItems="center"
              gap="$3"
              padding="$3"
              borderRadius={14}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            >
              <YStack
                width={40}
                height={40}
                borderRadius={999}
                backgroundColor={ui.roseSurface}
                alignItems="center"
                justifyContent="center"
              >
                <Icons.Store size={18} color={ui.brand} />
              </YStack>
              <YStack flex={1} minWidth={0} gap={2}>
                <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
                  {shop.shop_name}
                </Text>
                <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                  {[shop.city, shop.state].filter(Boolean).join(', ')}
                  {shop.distance != null ? ` · ${shop.distance.toFixed(1)} km` : ''}
                </Text>
              </YStack>
              {shop.verified ? <Icons.BadgeCheck size={16} color={ui.success} /> : null}
            </XStack>
          </AppLink>
        ))}
      </YStack>
    </YStack>
  )
}
