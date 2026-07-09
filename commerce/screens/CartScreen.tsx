import { Link, useRouter } from 'one'
import { useEffect, useMemo, useState } from 'react'

import {
  Button,
  Icons,
  Image,
  Spinner,
  Text,
  Theme,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, PageRail, PageSection } from '~/components/layout'
import { BRAND_THEME } from '~/config/tokens'
import { useCart } from '~/commerce/hooks/useCart'
import { ListingTypeBadge } from '~/commerce/components'
import { fetchListingSlugMap, fetchListingTypesByIds, isDigitalListing } from '~/lib/supabase/commerce'
import { formatCurrency } from '~/lib/format'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CartScreen() {
  const ui = useAppUi()
  const { cart, items, isLoading, error, updateQuantity, removeItem } = useCart()
  const toast = useAppToast()
  const router = useRouter()
  const [listingSlugs, setListingSlugs] = useState<Map<string, string>>(new Map())
  const [listingTypes, setListingTypes] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const ids = items.map((item) => item.listing_id)
    if (!ids.length) {
      setListingSlugs(new Map())
      setListingTypes(new Map())
      return
    }
    void Promise.all([fetchListingSlugMap(ids), fetchListingTypesByIds(ids)]).then(
      ([slugs, types]) => {
        setListingSlugs(slugs)
        setListingTypes(types)
      },
    )
  }, [items])

  const groupedByShop = useMemo(() => {
    const groups = new Map<string, typeof items>()
    for (const item of items) {
      const existing = groups.get(item.shop_id) ?? []
      existing.push(item)
      groups.set(item.shop_id, existing)
    }
    return [...groups.entries()]
  }, [items])

  const currency = cart?.currency ?? 'INR'
  const subtotal = cart?.items_subtotal ?? items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const total = cart?.total_amount ?? subtotal

  function listingHref(listingId: string) {
    return commerceRoutes.listing(listingSlugs.get(listingId) ?? listingId)
  }

  async function handleQuantityChange(itemId: string, nextQuantity: number) {
    const { error: updateError } = await updateQuantity(itemId, nextQuantity)
    if (updateError) {
      toast.show('Could not update item', { tone: 'danger', message: updateError })
    }
  }

  async function handleRemove(itemId: string) {
    const { error: removeError } = await removeItem(itemId)
    if (removeError) {
      toast.show('Could not remove item', { tone: 'danger', message: removeError })
    }
  }

  if (isLoading) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <PageRail>
          <YStack gap="$5" width="100%">
            <YStack gap="$1">
              <Text fontSize={28} fontWeight="500" color={ui.text} letterSpacing={-0.4}>
                Your cart
              </Text>
              <Text fontSize={14} color={ui.textSecondary}>
                {items.length
                  ? `${items.reduce((sum, item) => sum + item.quantity, 0)} items from ${groupedByShop.length} ${groupedByShop.length === 1 ? 'shop' : 'shops'}`
                  : 'Your cart is empty'}
              </Text>
            </YStack>

            {error ? (
              <Text color={ui.danger} fontSize={14}>
                {error}
              </Text>
            ) : null}

            {items.length === 0 ? (
              <YStack
                alignItems="center"
                justifyContent="center"
                paddingVertical="$10"
                gap="$4"
                borderRadius={12}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
              >
                <Icons.ShoppingBag size={40} color={ui.icon} />
                <Text fontSize={16} color={ui.textSecondary} textAlign="center">
                  Discover something you love and add it to your cart.
                </Text>
                <Link href={commerceRoutes.home} asChild>
                  <Theme name={BRAND_THEME}>
                    <Button tone="primary" size="$4" borderRadius={999}>
                      Continue shopping
                    </Button>
                  </Theme>
                </Link>
              </YStack>
            ) : (
              <YStack gap="$5" width="100%">
                <YStack flex={1} minWidth={280} gap="$4">
                  {groupedByShop.map(([shopId, shopItems]) => (
                    <YStack
                      key={shopId}
                      gap="$3"
                      padding="$4"
                      borderRadius={12}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      backgroundColor={ui.surface}
                    >
                      <Text fontWeight="500" fontSize={15} color={ui.text}>
                        {shopItems[0]?.shop_name}
                      </Text>
                      {shopItems.map((item) => (
                        <XStack key={item.id} gap="$3" alignItems="center">
                          <Link href={listingHref(item.listing_id)} asChild>
                            <YStack
                              width={88}
                              height={88}
                              borderRadius={8}
                              overflow="hidden"
                              backgroundColor={ui.imagePlaceholder}
                              cursor="pointer"
                            >
                              {item.image_url ? (
                                <Image
                                  src={item.image_url}
                                  width={88}
                                  height={88}
                                  objectFit="cover"
                                />
                              ) : null}
                            </YStack>
                          </Link>
                          <YStack flex={1} gap="$2">
                            <Link href={listingHref(item.listing_id)} asChild>
                              <Text
                                fontSize={14}
                                color={ui.text}
                                numberOfLines={2}
                                cursor="pointer"
                                hoverStyle={{ textDecorationLine: 'underline' }}
                              >
                                {item.title}
                              </Text>
                            </Link>
                            {item.variant_name ? (
                              <Text fontSize={12} color={ui.textSecondary}>
                                {item.variant_name}
                                {item.variant_value ? `: ${item.variant_value}` : ''}
                              </Text>
                            ) : null}
                            {listingTypes.get(item.listing_id) ? (
                              <ListingTypeBadge
                                listingType={listingTypes.get(item.listing_id)!}
                                compact
                                deliveryHint={
                                  isDigitalListing(listingTypes.get(item.listing_id))
                                    ? 'Instant download'
                                    : 'Ships to you'
                                }
                              />
                            ) : null}
                            <Text fontWeight="700" fontSize={15} color={ui.text}>
                              {formatCurrency(item.unit_price, currency)}
                            </Text>
                            <XStack gap="$2" alignItems="center">
                              <Button
                                tone="outline"
                                size="$2"
                                borderRadius={999}
                                onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                              >
                                −
                              </Button>
                              <Text fontSize={14} minWidth={24} textAlign="center">
                                {item.quantity}
                              </Text>
                              <Button
                                tone="outline"
                                size="$2"
                                borderRadius={999}
                                onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                              >
                                +
                              </Button>
                              <Button
                                tone="ghost"
                                size="$2"
                                onPress={() => handleRemove(item.id)}
                              >
                                Remove
                              </Button>
                            </XStack>
                          </YStack>
                        </XStack>
                      ))}
                    </YStack>
                  ))}
                </YStack>

                <YStack
                  width="100%"
                  gap="$4"
                  padding="$4"
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  style={{ boxShadow: ui.shadowCard }}
                  $gtMd={{
                    width: 320,
                    maxWidth: '100%',
                    position: 'sticky',
                    top: 80,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text fontWeight="500" fontSize={18} color={ui.text}>
                    Order summary
                  </Text>
                  <XStack justifyContent="space-between">
                    <Text color={ui.textSecondary}>Subtotal</Text>
                    <Text fontWeight="500">{formatCurrency(subtotal, currency)}</Text>
                  </XStack>
                  {cart?.discount_amount ? (
                    <XStack justifyContent="space-between">
                      <Text color={ui.textSecondary}>Discount</Text>
                      <Text fontWeight="500" color={ui.brand}>
                        −{formatCurrency(cart.discount_amount, currency)}
                      </Text>
                    </XStack>
                  ) : null}
                  <XStack justifyContent="space-between" paddingTop="$2" borderTopWidth={1} borderTopColor={ui.borderSubtle}>
                    <Text fontWeight="700" fontSize={16}>
                      Total
                    </Text>
                    <Text fontWeight="700" fontSize={16}>
                      {formatCurrency(total, currency)}
                    </Text>
                  </XStack>
                  <Theme name={BRAND_THEME}>
                    <Button
                      tone="primary"
                      size="$4"
                      borderRadius={999}
                      onPress={() => router.push(commerceRoutes.checkout)}
                    >
                      Proceed to checkout
                    </Button>
                  </Theme>
                  <Link href={commerceRoutes.home} asChild>
                    <Button tone="outline" size="$3" borderRadius={999}>
                      Continue shopping
                    </Button>
                  </Link>
                </YStack>
              </YStack>
            )}
          </YStack>
        </PageRail>
      </PageSection>
    </FullWidthLayout>
  )
}