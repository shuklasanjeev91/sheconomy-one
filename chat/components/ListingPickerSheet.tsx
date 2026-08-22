import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { postProductToChatListing } from '~/chat/lib/listing-message'
import type { ChatListingPayload } from '~/chat/lib/types'
import {
  fetchRecentlyViewedAttachProducts,
  fetchWishlistAttachProducts,
  searchAttachProducts,
} from '~/community/lib/attach-listing-products'
import type { PostProduct } from '~/community/lib/community'
import { useRecentlyViewed } from '~/commerce/lib/recently-viewed'
import { ScreenSearchField } from '~/components/search'
import {
  AppBottomSheet,
  Icons,
  Image,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { formatMoneyLabel } from '~/lib/format'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'

type ListingPickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string | null
  onPick: (listing: ChatListingPayload) => void
}

type Tab = 'recent' | 'saved' | 'search'

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return 'Free'
  return formatMoneyLabel(price, currency ?? 'INR')
}

function ProductRow({
  product,
  onPress,
}: {
  product: PostProduct
  onPress: () => void
}) {
  const theme = useChatTheme()
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      alignItems="center"
      gap={12}
      paddingVertical={9}
      paddingHorizontal={6}
      borderRadius={10}
      hoverStyle={{ backgroundColor: theme.listItemHover }}
      pressStyle={{ backgroundColor: theme.listItemActive }}
      animation="quick"
    >
      <YStack
        width={48}
        height={48}
        borderRadius={10}
        overflow="hidden"
        backgroundColor={theme.reactionBg}
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {product.imageUrl ? (
          <Image src={product.imageUrl} width={48} height={48} objectFit="cover" alt="" />
        ) : (
          <Icons.Package size={20} color={theme.textMuted} />
        )}
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={15} fontWeight="600" color={theme.text} numberOfLines={2}>
          {product.title}
        </Text>
        <XStack gap={8} alignItems="center" flexWrap="wrap">
          <Text fontSize={13} fontWeight="700" color={theme.brand}>
            {formatPrice(product.price, product.currency)}
          </Text>
          {product.shopName ? (
            <Text fontSize={12} color={theme.textMuted} numberOfLines={1}>
              {product.shopName}
            </Text>
          ) : null}
        </XStack>
      </YStack>
      <Icons.Send size={17} color={theme.brand} />
    </XStack>
  )
}

/** Pick a marketplace listing to send as a chat product card. */
export function ListingPickerSheet({
  open,
  onOpenChange,
  currentUserId,
  onPick,
}: ListingPickerSheetProps) {
  const theme = useChatTheme()
  const recentIds = useRecentlyViewed()
  const [tab, setTab] = useState<Tab>('recent')
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const tabs: Array<[Tab, string]> = [
    ['recent', 'Recent'],
    ['saved', 'Saved'],
    ['search', 'Search'],
  ]

  useEffect(() => {
    if (!open) {
      setTab('recent')
      setQuery('')
      return
    }
    if (!currentUserId) {
      setProducts([])
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      if (tab === 'recent') {
        const rows = await fetchRecentlyViewedAttachProducts(recentIds)
        if (!cancelled) setProducts(rows)
      } else if (tab === 'saved') {
        const rows = await fetchWishlistAttachProducts(currentUserId!)
        if (!cancelled) setProducts(rows)
      } else {
        const rows = query.trim() ? await searchAttachProducts(query.trim()) : []
        if (!cancelled) setProducts(rows)
      }
      if (!cancelled) setLoading(false)
    }

    if (tab === 'search' && !query.trim()) {
      setProducts([])
      setLoading(false)
      return
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, currentUserId, tab, query, recentIds])

  const filteredProducts = useMemo(
    () => (tab === 'search' ? products : filterBySearchQuery(products, query, (p) => [p.title, p.shopName])),
    [products, query, tab],
  )

  const showSearch =
    tab === 'search' || products.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0

  function handlePick(product: PostProduct) {
    const listing = postProductToChatListing(product)
    if (!listing) return
    onPick(listing)
    onOpenChange(false)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Share product" scrollable={false}>
      <XStack gap={8} flexWrap="wrap" paddingBottom={8}>
        {tabs.map(([key, label]) => {
          const active = tab === key
          return (
            <XStack
              key={key}
              paddingHorizontal={14}
              paddingVertical={7}
              borderRadius={999}
              borderWidth={1}
              borderColor={active ? theme.brand : theme.border}
              backgroundColor={active ? theme.brand : theme.cardBg}
              cursor="pointer"
              onPress={() => setTab(key)}
            >
              <Text fontSize={13} fontWeight="700" color={active ? theme.brandContrast : theme.text}>
                {label}
              </Text>
            </XStack>
          )
        })}
      </XStack>

      {showSearch ? (
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'search' ? 'Search products' : 'Filter products'}
          clearable
        />
      ) : null}

      {!currentUserId ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Package size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            Sign in to share products.
          </Text>
        </YStack>
      ) : loading ? (
        <YStack paddingVertical={24} alignItems="center">
          <Spinner size="small" color={theme.brand} />
        </YStack>
      ) : tab === 'search' && !query.trim() ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Search size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            Search the marketplace to share a product.
          </Text>
        </YStack>
      ) : filteredProducts.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.Package size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            {tab === 'saved' ? 'No saved products yet.' : 'No products to show.'}
          </Text>
        </YStack>
      ) : (
        <ScrollView
          style={{ maxHeight: 360 }}
          nestedScrollEnabled={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {filteredProducts.map((product) => (
            <ProductRow
              key={product.listingId ?? product.slug ?? product.title}
              product={product}
              onPress={() => handlePick(product)}
            />
          ))}
        </ScrollView>
      )}
    </AppBottomSheet>
  )
}
