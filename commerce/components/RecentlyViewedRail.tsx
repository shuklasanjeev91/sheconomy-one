import { useEffect, useState } from 'react'
import { Share } from 'react-native'

import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { PageSection } from '~/components/layout'
import { Text, XStack, YStack, useAppToast } from '~/components/ui'
import { clearRecentlyViewed, useRecentlyViewed } from '~/commerce/lib/recently-viewed'
import { BRAND_NAME } from '~/config/brand'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { getListingShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CommerceSection } from '~/commerce/components/CommerceSection'
import { ListingCarouselRow } from '~/commerce/components/ListingCarouselRow'

type RecentlyViewedRailProps = {
  /** Listing ids to hide (e.g. items already in the cart). */
  excludeIds?: string[]
  title?: string
  subtitle?: string
  /** Wrap in PageSection only when there are items (avoids empty home gaps). */
  inset?: boolean
}

/** Horizontal "Recently viewed" rail backed by the local recently-viewed store. */
export function RecentlyViewedRail({
  excludeIds = [],
  title = 'Recently viewed',
  subtitle = 'Pick up where you left off',
  inset = false,
}: RecentlyViewedRailProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const recentIds = useRecentlyViewed(excludeIds)
  const [items, setItems] = useState<ListingSummary[]>([])

  useEffect(() => {
    if (recentIds.length === 0) {
      setItems([])
      return
    }
    let active = true
    void fetchListingsByIds(recentIds.slice(0, 12)).then((listings) => {
      if (!active) return
      const order = new Map(recentIds.map((id, index) => [id, index]))
      setItems([...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
    })
    return () => {
      active = false
    }
  }, [recentIds.join(',')])

  async function handleShareRecent() {
    if (!items.length) return
    const lines = items.slice(0, 8).map((item) => {
      const price =
        typeof item.price === 'number'
          ? ` — ${formatCurrency(item.price, item.currency ?? 'INR')}`
          : ''
      const url = item.slug ? getListingShareUrl(item.slug) : ''
      return `• ${item.title}${price}${url ? `\n  ${url}` : ''}`
    })
    const message = [`Recently viewed on ${BRAND_NAME}`, '', ...lines].join('\n')
    try {
      await Share.share({ title: 'Recently viewed', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'List copied' : 'Could not share', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  if (items.length === 0) return null

  const content = (
    <CommerceSection
      title={title}
      subtitle={subtitle}
      action={
        <XStack alignItems="center" gap="$3">
          <Text
            fontSize={13}
            fontWeight="600"
            color={ui.brand}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => void handleShareRecent()}
          >
            Share
          </Text>
          <Text
            fontSize={13}
            fontWeight="600"
            color={ui.textMuted}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            onPress={() => clearRecentlyViewed()}
          >
            Clear
          </Text>
        </XStack>
      }
    >
      <ListingCarouselRow listings={items} />
    </CommerceSection>
  )

  return inset ? <PageSection>{content}</PageSection> : content
}
