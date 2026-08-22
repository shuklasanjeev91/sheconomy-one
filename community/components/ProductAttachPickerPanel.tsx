import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import type { SellerListingRow } from '~/commerce/lib/seller-dashboard'
import {
  MAX_ATTACHED_PRODUCTS,
  type ProductPickerTab,
} from '~/community/lib/attach-listing-products'
import type { PostProduct } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { VendorShop } from '~/hooks/useVendorShops'
import { ScreenSearchField } from '~/components/search'
import { Icons, Image, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { SHEET_SEARCH_MIN_ITEMS } from '~/lib/search'

function PickerListScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={{ maxHeight: 320 }}
      nestedScrollEnabled={Platform.OS === 'android'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <YStack gap={8}>{children}</YStack>
    </ScrollView>
  )
}

export type ProductAttachPickerPanelProps = {
  tabs: Array<[ProductPickerTab, string]>
  productPickerTab: ProductPickerTab
  onTabChange: (tab: ProductPickerTab) => void
  shops: VendorShop[]
  activeShopId: string | null
  onActiveShopChange: (shopId: string) => void
  listings: SellerListingRow[]
  loadingListings: boolean
  listingSearchQuery: string
  onListingSearchQueryChange: (value: string) => void
  filteredListings: SellerListingRow[]
  onToggleListing: (listing: SellerListingRow) => void
  recentProducts: PostProduct[]
  loadingRecentProducts: boolean
  savedProducts: PostProduct[]
  loadingSavedProducts: boolean
  searchProducts: PostProduct[]
  loadingSearchProducts: boolean
  catalogSearchQuery: string
  onCatalogSearchQueryChange: (value: string) => void
  attachedProducts: PostProduct[]
  onToggleProduct: (product: PostProduct) => void
  formatPrice: (price: number | null, currency: string | null) => string
}

export function ProductAttachPickerPanel(props: ProductAttachPickerPanelProps) {
  const {
    tabs,
    productPickerTab,
    onTabChange,
    shops,
    activeShopId,
    onActiveShopChange,
    listings,
    loadingListings,
    listingSearchQuery,
    onListingSearchQueryChange,
    filteredListings,
    onToggleListing,
    recentProducts,
    loadingRecentProducts,
    savedProducts,
    loadingSavedProducts,
    searchProducts,
    loadingSearchProducts,
    catalogSearchQuery,
    onCatalogSearchQueryChange,
    attachedProducts,
    onToggleProduct,
    formatPrice,
  } = props
  const communityUi = useCommunityUi()
  const activeShop = shops.find((shop) => shop.id === activeShopId) ?? null

  return (
    <YStack gap={10}>
      <Text fontSize={12} color={communityUi.textMuted}>
        Attach up to {MAX_ATTACHED_PRODUCTS} listings ({attachedProducts.length}/{MAX_ATTACHED_PRODUCTS}).
      </Text>
      <XStack gap={6} flexWrap="wrap">
        {tabs.map(([tab, label]) => (
          <ContextChip
            key={tab}
            label={label}
            active={productPickerTab === tab}
            onPress={() => onTabChange(tab)}
          />
        ))}
      </XStack>

      {productPickerTab === 'yours' ? (
        <YStack gap={10}>
          {shops.length > 1 ? (
            <XStack gap={8} flexWrap="wrap">
              {shops.map((shopItem) => (
                <ContextChip
                  key={shopItem.id}
                  label={shopItem.shop_name}
                  active={activeShopId === shopItem.id}
                  onPress={() => {
                    onActiveShopChange(shopItem.id)
                    onListingSearchQueryChange('')
                  }}
                />
              ))}
            </XStack>
          ) : null}

          {shops.length === 0 ? (
            <EmptyPickerHint
              icon={Icons.ShoppingBag}
              message="No shop yet — use Recent, Saved, or Search to tag products."
            />
          ) : loadingListings ? (
            <XStack paddingVertical={16} justifyContent="center">
              <Spinner size="small" color={communityUi.brand} />
            </XStack>
          ) : listings.length === 0 ? (
            <EmptyPickerHint icon={Icons.Package} message="No active listings in this shop yet." />
          ) : (
            <YStack gap={8}>
              {listings.length >= SHEET_SEARCH_MIN_ITEMS || listingSearchQuery.length > 0 ? (
                <ScreenSearchField
                  value={listingSearchQuery}
                  onChangeText={onListingSearchQueryChange}
                  placeholder="Search your listings"
                  clearable
                />
              ) : null}
              {filteredListings.length === 0 ? (
                <Text fontSize={13} color={communityUi.textMuted}>
                  No listings match your search.
                </Text>
              ) : (
                <PickerListScroll>
                  {filteredListings.map((listing) => (
                    <PickerRow
                      key={listing.id}
                      title={listing.title}
                      subtitle={formatPrice(listing.price, activeShop?.shop_currency ?? null)}
                      imageUrl={listing.primaryImageUrl}
                      fallbackIcon={Icons.Package}
                      selected={attachedProducts.some((product) => product.listingId === listing.id)}
                      onPress={() => onToggleListing(listing)}
                    />
                  ))}
                </PickerListScroll>
              )}
            </YStack>
          )}
        </YStack>
      ) : null}

      {productPickerTab === 'recent' ? (
        loadingRecentProducts ? (
          <XStack paddingVertical={16} justifyContent="center">
            <Spinner size="small" color={communityUi.brand} />
          </XStack>
        ) : recentProducts.length === 0 ? (
          <EmptyPickerHint icon={Icons.History} message="Browse the shop to see listings here." />
        ) : (
          <PickerListScroll>
            {recentProducts.map((product) => (
              <PickerRow
                key={product.listingId ?? product.slug ?? product.title}
                title={product.title}
                subtitle={[formatPrice(product.price, product.currency), product.shopName]
                  .filter(Boolean)
                  .join(' · ')}
                imageUrl={product.imageUrl}
                fallbackIcon={Icons.Package}
                selected={attachedProducts.some((item) => item.listingId === product.listingId)}
                onPress={() => onToggleProduct(product)}
              />
            ))}
          </PickerListScroll>
        )
      ) : null}

      {productPickerTab === 'saved' ? (
        loadingSavedProducts ? (
          <XStack paddingVertical={16} justifyContent="center">
            <Spinner size="small" color={communityUi.brand} />
          </XStack>
        ) : savedProducts.length === 0 ? (
          <EmptyPickerHint
            icon={Icons.Heart}
            message="No saved listings yet. Save products from the shop to tag them here."
          />
        ) : (
          <PickerListScroll>
            {savedProducts.map((product) => (
              <PickerRow
                key={product.listingId ?? product.slug ?? product.title}
                title={product.title}
                subtitle={[formatPrice(product.price, product.currency), product.shopName]
                  .filter(Boolean)
                  .join(' · ')}
                imageUrl={product.imageUrl}
                fallbackIcon={Icons.Package}
                selected={attachedProducts.some((item) => item.listingId === product.listingId)}
                onPress={() => onToggleProduct(product)}
              />
            ))}
          </PickerListScroll>
        )
      ) : null}

      {productPickerTab === 'search' ? (
        <YStack gap={8}>
          <ScreenSearchField
            value={catalogSearchQuery}
            onChangeText={onCatalogSearchQueryChange}
            placeholder="Search the marketplace"
            clearable
          />
          {loadingSearchProducts ? (
            <XStack paddingVertical={16} justifyContent="center">
              <Spinner size="small" color={communityUi.brand} />
            </XStack>
          ) : !catalogSearchQuery.trim() ? (
            <Text fontSize={13} color={communityUi.textMuted}>
              Search published listings to attach.
            </Text>
          ) : searchProducts.length === 0 ? (
            <Text fontSize={13} color={communityUi.textMuted}>
              No listings match your search.
            </Text>
          ) : (
            <PickerListScroll>
              {searchProducts.map((product) => (
                <PickerRow
                  key={product.listingId ?? product.slug ?? product.title}
                  title={product.title}
                  subtitle={[formatPrice(product.price, product.currency), product.shopName]
                    .filter(Boolean)
                    .join(' · ')}
                  imageUrl={product.imageUrl}
                  fallbackIcon={Icons.Package}
                  selected={attachedProducts.some((item) => item.listingId === product.listingId)}
                  onPress={() => onToggleProduct(product)}
                />
              ))}
            </PickerListScroll>
          )}
        </YStack>
      ) : null}
    </YStack>
  )
}

function ContextChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={12}
      paddingVertical={6}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? communityUi.accentMuted : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="600" color={active ? communityUi.brand : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function EmptyPickerHint({ icon: Icon, message }: { icon: typeof Icons.Store; message: string }) {
  const communityUi = useCommunityUi()
  return (
    <YStack
      padding={16}
      gap={8}
      alignItems="center"
      borderRadius={12}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.cardBg}
    >
      <Icon size={24} color={communityUi.textMuted} />
      <Text fontSize={13} color={communityUi.textMuted} textAlign="center">
        {message}
      </Text>
    </YStack>
  )
}

function PickerRow({
  title,
  subtitle,
  imageUrl,
  fallbackIcon: FallbackIcon,
  selected,
  onPress,
}: {
  title: string
  subtitle?: string
  imageUrl?: string | null
  fallbackIcon: typeof Icons.Package
  selected: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      alignItems="center"
      gap={12}
      padding={8}
      borderRadius={12}
      borderWidth={1}
      borderColor={selected ? communityUi.brand : communityUi.border}
      backgroundColor={selected ? communityUi.accentMuted : communityUi.cardBg}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      onPress={onPress}
    >
      <YStack
        width={48}
        height={48}
        borderRadius={8}
        overflow="hidden"
        backgroundColor={communityUi.pageBg}
        alignItems="center"
        justifyContent="center"
      >
        {imageUrl ? (
          <Image src={imageUrl} width={48} height={48} objectFit="cover" alt="" />
        ) : (
          <FallbackIcon size={20} color={communityUi.textMuted} />
        )}
      </YStack>
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {selected ? <Icons.Check size={20} color={communityUi.brand} /> : null}
    </XStack>
  )
}
