import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { CommercePanel } from '~/commerce/components'
import { fetchSellerListings, type SellerListingRow } from '~/commerce/lib/seller-dashboard'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const LOW_STOCK_THRESHOLD = 5

type SellerLowStockCardProps = {
  shopId: string
}

/** Surfaces listings that need restocking — same on web and native. */
export function SellerLowStockCard({ shopId }: SellerLowStockCardProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [rows, setRows] = useState<SellerListingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchSellerListings(shopId, { status: 'active', limit: 80 })
      .then((listings) => {
        if (!active) return
        const low = listings
          .filter(
            (listing) =>
              typeof listing.quantity === 'number' &&
              listing.quantity >= 0 &&
              listing.quantity <= LOW_STOCK_THRESHOLD,
          )
          .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))
          .slice(0, 5)
        setRows(low)
      })
      .catch(() => {
        if (active) setRows([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [shopId])

  async function handleShareReport() {
    const lines = rows.map((listing) => `• ${listing.title || 'Untitled'} — ${listing.quantity ?? 0} left`)
    const message = [`Low stock report · ${BRAND_NAME}`, '', ...lines].join('\n')
    try {
      await Share.share({ title: 'Low stock report', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Report copied' : 'Could not share report', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  if (loading) {
    return (
      <CommercePanel padding="$4">
        <Spinner size="small" color={ui.brand} />
      </CommercePanel>
    )
  }

  if (rows.length === 0) return null

  return (
    <CommercePanel padding="$4" gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Icons.AlertTriangle size={16} color={ui.danger} />
          <Text fontSize={15} fontWeight="700" color={ui.text}>
            Low stock ({rows.length})
          </Text>
        </XStack>
        <Text
          fontSize={12}
          fontWeight="700"
          color={ui.brand}
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => void handleShareReport()}
        >
          Share
        </Text>
      </XStack>
      <YStack gap="$2">
        {rows.map((listing) => (
          <XStack key={listing.id} justifyContent="space-between" gap="$2" alignItems="center">
            <Text fontSize={13} color={ui.text} flex={1} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text fontSize={12} fontWeight="700" color={ui.danger}>
              {listing.quantity ?? 0} left
            </Text>
          </XStack>
        ))}
      </YStack>
      <AppLink href={vendorRoutes.products} asChild>
        <Button tone="outline" size="$3" borderRadius={999} alignSelf="flex-start">
          Manage inventory
        </Button>
      </AppLink>
    </CommercePanel>
  )
}
