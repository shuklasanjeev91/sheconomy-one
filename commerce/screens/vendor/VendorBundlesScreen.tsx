import { useEffect, useState } from 'react'

import { VendorNoShopState } from '~/commerce/components/vendor/VendorShopGate'
import {
  fetchShopBundles,
  saveShopBundle,
  setBundleActive,
  type ListingBundle,
} from '~/commerce/lib/listing-bundles'
import { PageCenter } from '~/components/layout'
import { Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorBundlesScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()
  const shop = useAppSelector((state) => state.shop.currentShop)
  const [bundles, setBundles] = useState<ListingBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [listingIds, setListingIds] = useState('')

  async function reload() {
    if (!shop?.id) return
    const rows = await fetchShopBundles(shop.id)
    setBundles(rows)
  }

  useEffect(() => {
    if (!shop?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    void reload().finally(() => setLoading(false))
  }, [shop?.id])

  if (!shop) {
    return (
      <VendorNoShopState
        ui={ui}
        title="No shop yet"
        body="Create a shop first to sell product bundles."
      />
    )
  }

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 28 : 23} fontWeight="800" color={ui.text}>
          Product bundles
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Sell kits at a bundle price. Checkout decrements each child listing.
        </Text>
      </YStack>

      <YStack gap="$3" padding="$4" borderWidth={1} borderColor={ui.borderSubtle} borderRadius={16}>
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          New bundle
        </Text>
        <Input value={title} onChangeText={setTitle} placeholder="Bundle title" />
        <Input value={price} onChangeText={setPrice} placeholder="Bundle price" keyboardType="decimal-pad" />
        <Input
          value={listingIds}
          onChangeText={setListingIds}
          placeholder="Listing IDs, comma separated"
        />
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          onPress={() => {
            const ids = listingIds
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
            void saveShopBundle({
              shopId: shop.id,
              title,
              bundlePrice: Number(price),
              listingIds: ids,
            }).then(({ error }) => {
              if (error) {
                toast.show(error, { tone: 'danger' })
                return
              }
              toast.show('Bundle saved', { tone: 'success' })
              setTitle('')
              setPrice('')
              setListingIds('')
              void reload()
            })
          }}
        >
          Save bundle
        </Button>
      </YStack>

      {loading ? (
        <PageCenter>
          <Spinner size="large" />
        </PageCenter>
      ) : (
        <YStack gap="$3">
          {bundles.map((bundle) => (
            <YStack
              key={bundle.id}
              gap="$2"
              padding="$4"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              borderRadius={16}
            >
              <XStack justifyContent="space-between" gap="$2">
                <Text fontSize={16} fontWeight="800" color={ui.text}>
                  {bundle.title}
                </Text>
                <Text fontSize={14} fontWeight="700" color={ui.brand}>
                  {bundle.bundle_price}
                </Text>
              </XStack>
              <Text fontSize={12} color={ui.textSecondary}>
                {bundle.items.map((item) => item.title ?? item.listing_id).join(' · ') || 'No products'}
              </Text>
              <Button
                tone="outline"
                size="$2"
                alignSelf="flex-start"
                onPress={() => {
                  void setBundleActive(bundle.id, !bundle.is_active).then((error) => {
                    if (error) toast.show(error, { tone: 'danger' })
                    else void reload()
                  })
                }}
              >
                {bundle.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
