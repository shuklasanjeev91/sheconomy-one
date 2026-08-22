import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { useRecentlyViewed } from '~/commerce/lib/recently-viewed'
import { fetchListingsByIds, type ListingSummary } from '~/commerce/lib/commerce'
import { formatMoneyLabel } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'

export function CommunityRecentlyViewedStrip() {
  const communityUi = useCommunityUi()
  const recentIds = useRecentlyViewed()
  const [items, setItems] = useState<ListingSummary[]>([])

  useEffect(() => {
    if (!recentIds.length) {
      setItems([])
      return
    }
    let active = true
    void fetchListingsByIds(recentIds.slice(0, 8)).then((listings) => {
      if (!active) return
      const order = new Map(recentIds.map((id, index) => [id, index]))
      setItems([...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
    })
    return () => {
      active = false
    }
  }, [recentIds.join(',')])

  const hasContent = items.length > 0
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Recently viewed
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Products you browsed recently — pick up where you left off.
          </Text>
        </YStack>
        <AppLink href={commerceRoutes.browse('featured')} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            Browse
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {items.map((item) => (
          <AppLink key={item.id} href={commerceRoutes.listing(item.slug ?? item.id)} asChild>
            <YStack
              width={196}
              padding={12}
              gap={10}
              borderRadius={14}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.pageBg}
              cursor="pointer"
            >
              <YStack
                width="100%"
                height={96}
                borderRadius={10}
                overflow="hidden"
                backgroundColor={communityUi.surfaceMuted}
                alignItems="center"
                justifyContent="center"
              >
                {item.image_url ? (
                  <Image src={item.image_url} width="100%" height={96} objectFit="cover" />
                ) : (
                  <Icons.Package size={22} color={communityUi.textMuted} />
                )}
              </YStack>
              <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
                {item.card_title || item.title}
              </Text>
              <Text fontSize={12} fontWeight="700" color={communityUi.text}>
                {formatMoneyLabel(item.price, item.currency)}
              </Text>
            </YStack>
          </AppLink>
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
