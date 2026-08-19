import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { ListingBrowseView, RecentlyViewedRail } from '~/commerce/components'
import { WishlistReactivationSection } from '~/commerce/components/WishlistReactivationSection'
import { useCart } from '~/commerce/hooks/useCart'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import {
  buildWishlistReactivation,
  clearWishlistSavedFromCartMarker,
  clearWishlistSavedFromCartMarkers,
  readSavedFromCartWishlistMap,
  type WishlistReactivationItem,
  type WishlistReactivationSection as WishlistReactivationSectionType,
} from '~/commerce/lib/wishlist-reactivation'
import {
  createWishlistCollection,
  ensureWishlistShareLink,
  fetchWishlistCollections,
  fetchWishlistListingIdsInCollection,
  type WishlistCollection,
} from '~/commerce/lib/wishlist'
import {
  buildStockAlertSections,
  fetchStockAlertListings,
  unsubscribeStockAlert,
  type StockAlertListing,
  type StockAlertSection,
} from '~/commerce/lib/stock-alerts'
import { WishlistMoveSheet } from '~/commerce/components/WishlistMoveSheet'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { BRAND_NAME } from '~/config/brand'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function FavoritesScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { favoriteIds, isLoading: isFavoritesLoading, toggleFavorite } = useFavorites()
  const { addToCart } = useCart()
  const [items, setItems] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collections, setCollections] = useState<WishlistCollection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [moveListingId, setMoveListingId] = useState<string | null>(null)
  const [savedFromCartMap, setSavedFromCartMap] = useState<Record<string, number>>({})
  const [stockAlerts, setStockAlerts] = useState<StockAlertListing[]>([])

  async function refreshSavedFromCartMap() {
    setSavedFromCartMap(await readSavedFromCartWishlistMap())
  }

  const loadStockAlerts = useCallback(async () => {
    if (!user?.id) {
      setStockAlerts([])
      return
    }
    const result = await fetchStockAlertListings(user.id)
    if (!result.error) setStockAlerts(result.items)
  }, [user?.id])

  async function handleShareWishlist(targetItems: ListingSummary[] = items) {
    if (!targetItems.length) {
      toast.show('Save items before sharing', { tone: 'info' })
      return
    }

    if (user?.id) {
      const result = await ensureWishlistShareLink({
        userId: user.id,
        collectionId: activeCollectionId,
        listingIds: targetItems.map((item) => item.id),
      })
      if (result.error || !result.shareUrl) {
        toast.show('Could not create share link', {
          tone: 'danger',
          message: result.error ?? 'Try again',
        })
        return
      }
      if (result.collectionId && result.collectionId !== activeCollectionId) {
        setActiveCollectionId(result.collectionId)
        await loadCollections()
      }
      try {
        await Share.share({
          title: 'Wishlist',
          message: `Wishlist on ${BRAND_NAME}\n${result.shareUrl}`,
          url: result.shareUrl,
        })
      } catch {
        const copied = await copyToClipboard(result.shareUrl)
        toast.show(copied ? 'Wishlist link copied' : 'Could not share wishlist', {
          tone: copied ? 'success' : 'danger',
        })
      }
      return
    }

    const lines = targetItems.slice(0, 12).map((item) => {
      const price =
        typeof item.price === 'number'
          ? ` — ${formatCurrency(item.price, item.currency ?? 'INR')}`
          : ''
      return `• ${item.title}${price}`
    })
    const message = [
      `Wishlist on ${BRAND_NAME}`,
      `${targetItems.length} saved item${targetItems.length === 1 ? '' : 's'}`,
      '',
      ...lines,
      targetItems.length > 12 ? `…and ${targetItems.length - 12} more` : null,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await Share.share({ title: 'Wishlist', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Wishlist copied' : 'Could not share wishlist', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  const loadCollections = useCallback(async () => {
    if (!user?.id) {
      setCollections([])
      return
    }
    const result = await fetchWishlistCollections(user.id)
    if (!result.error) setCollections(result.collections)
  }, [user?.id])

  const loadFavorites = useCallback(async () => {
    setIsLoading(true)
    try {
      let ids = favoriteIds
      if (user?.id && activeCollectionId) {
        const scoped = await fetchWishlistListingIdsInCollection(user.id, activeCollectionId)
        if (!scoped.error) ids = scoped.listingIds
      }

      if (!ids.length) {
        setItems([])
        setError(null)
        setIsLoading(false)
        return
      }

      const listings = await fetchListingsByIds(ids)
      const order = new Map(ids.map((id, index) => [id, index]))
      const sorted = [...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setItems(sorted)
      setError(null)
    } catch {
      setError('Could not load your favorites.')
    } finally {
      setIsLoading(false)
    }
  }, [activeCollectionId, favoriteIds, user?.id])

  useEffect(() => {
    void loadCollections()
  }, [loadCollections])

  useEffect(() => {
    void refreshSavedFromCartMap()
  }, [])

  useEffect(() => {
    void loadStockAlerts()
  }, [loadStockAlerts])

  useEffect(() => {
    if (isFavoritesLoading) return
    void loadFavorites()
  }, [isFavoritesLoading, loadFavorites])

  const reactivation = useMemo(
    () => buildWishlistReactivation({ items, savedFromCart: savedFromCartMap }),
    [items, savedFromCartMap],
  )
  const stockAlertSections = useMemo(() => buildStockAlertSections(stockAlerts), [stockAlerts])

  async function handleCreateCollection() {
    if (!user?.id || !newCollectionName.trim()) return
    setIsCreatingCollection(true)
    const result = await createWishlistCollection(user.id, newCollectionName)
    setIsCreatingCollection(false)
    if (result.error) {
      toast.show('Could not create collection', { tone: 'danger', message: result.error })
      return
    }
    setNewCollectionName('')
    await loadCollections()
    if (result.collection) setActiveCollectionId(result.collection.id)
    toast.show('Collection created', { tone: 'success' })
  }

  async function handleMoveToCart(item: WishlistReactivationItem) {
    const result = await addToCart(item.id)
    if (result.error) {
      toast.show('Choose options first', {
        tone: 'info',
        message: 'Open the product page to pick options before adding it to cart.',
      })
      navigateApp(commerceRoutes.listing(item.slug ?? item.id))
      return
    }
    await clearWishlistSavedFromCartMarker(item.id)
    await refreshSavedFromCartMap()
    toast.show('Moved to cart', {
      tone: 'success',
      message: item.source === 'saved_from_cart' ? 'Your saved cart pick is back in checkout.' : undefined,
    })
  }

  async function handleBuyNow(item: WishlistReactivationItem) {
    const result = await addToCart(item.id)
    if (result.error) {
      toast.show('Choose options first', {
        tone: 'info',
        message: 'Open the product page to pick options before buying now.',
      })
      navigateApp(commerceRoutes.listing(item.slug ?? item.id))
      return
    }
    await clearWishlistSavedFromCartMarker(item.id)
    await refreshSavedFromCartMap()
    navigateApp(commerceRoutes.checkout)
  }

  async function handleMoveAlertToCart(item: StockAlertListing) {
    const result = await addToCart(item.listingId)
    if (result.error) {
      toast.show('Open the product page to choose options', { tone: 'info' })
      navigateApp(commerceRoutes.listing(item.slug ?? item.listingId))
      return
    }
    toast.show('Moved to cart', { tone: 'success' })
    navigateApp(commerceRoutes.cart)
  }

  async function handleRemoveAlert(item: StockAlertListing) {
    if (!user?.id) return
    const result = await unsubscribeStockAlert(item.listingId, user.id)
    if (result.error) {
      toast.show('Could not remove alert', { tone: 'danger', message: result.error })
      return
    }
    await loadStockAlerts()
    toast.show('Alert removed', { tone: 'default' })
  }

  async function handleBulkPrimary(section: WishlistReactivationSectionType) {
    if (!section.items.length) return
    const succeeded: string[] = []
    let failed = 0
    for (const item of section.items) {
      const result = await addToCart(item.id)
      if (result.error) failed += 1
      else succeeded.push(item.id)
    }
    if (succeeded.length) {
      await clearWishlistSavedFromCartMarkers(succeeded)
      await refreshSavedFromCartMap()
    }
    toast.show(failed > 0 ? 'Moved what we could' : 'Moved to cart', {
      tone: failed > 0 ? 'info' : 'success',
      message:
        failed > 0
          ? `${succeeded.length} item${succeeded.length === 1 ? '' : 's'} moved. ${failed} need product-page option selection.`
          : `${succeeded.length} item${succeeded.length === 1 ? '' : 's'} moved to cart.`,
    })
  }

  const moreSavedSection = reactivation.sections.find((section) => section.key === 'more_saved') ?? null
  const topSections = reactivation.sections.filter((section) => section.key !== 'more_saved')

  if (isFavoritesLoading) {
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
      <PageSection paddingVertical="$6" gap="$4">
        <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
          <YStack gap={4} flex={1} minWidth={200}>
            <Text fontSize={22} fontWeight="800" color={ui.text}>
              Your wishlist
            </Text>
            <Text fontSize={14} color={ui.textSecondary}>
              {reactivation.counts.total > 0
                ? `${reactivation.counts.total} saved ${reactivation.counts.total === 1 ? 'item' : 'items'} · ${reactivation.counts.readyToBuy} ready to revisit`
                : 'Tap the heart on any listing to save it here'}
            </Text>
          </YStack>
          <XStack alignItems="center" gap="$2">
            {items.length > 0 ? (
              <Button
                size="$3"
                tone="outline"
                borderRadius={999}
                icon={<Icons.Share2 size={15} />}
                onPress={() => void handleShareWishlist()}
              >
                Share
              </Button>
            ) : null}
          </XStack>
        </XStack>

        {items.length > 0 ? (
          <XStack gap="$3" flexWrap="wrap">
            <SummaryCard label="Saved items" value={reactivation.counts.total} />
            <SummaryCard label="Ready to buy" value={reactivation.counts.readyToBuy} />
            <SummaryCard label="Saved from cart" value={reactivation.counts.savedFromCart} />
            <SummaryCard label="Price wins" value={reactivation.counts.priceWins} />
            <SummaryCard label="Restock alerts" value={stockAlerts.length} />
          </XStack>
        ) : null}

        {user ? (
          <YStack gap="$2">
            <XStack gap="$2" flexWrap="wrap">
              <Button
                size="$2"
                tone={activeCollectionId === null ? 'primary' : 'outline'}
                borderRadius={999}
                onPress={() => setActiveCollectionId(null)}
              >
                All
              </Button>
              {collections.map((collection) => (
                <Button
                  key={collection.id}
                  size="$2"
                  tone={activeCollectionId === collection.id ? 'primary' : 'outline'}
                  borderRadius={999}
                  onPress={() => setActiveCollectionId(collection.id)}
                >
                  {collection.name}
                </Button>
              ))}
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={newCollectionName}
                placeholder="New collection name"
                onChangeText={setNewCollectionName}
              />
              <Button
                size="$3"
                tone="outline"
                borderRadius={999}
                disabled={isCreatingCollection || !newCollectionName.trim()}
                onPress={() => void handleCreateCollection()}
              >
                Add
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {topSections.map((section) => (
          <WishlistReactivationSection
            key={section.key}
            section={section}
            onMoveToCart={(item) => void handleMoveToCart(item)}
            onBuyNow={(item) => void handleBuyNow(item)}
            onMoveToCollection={(item) => setMoveListingId(item.id)}
            onBulkPrimary={(current) => void handleBulkPrimary(current)}
          />
        ))}

        {stockAlertSections.map((section) => (
          <RestockAlertSection
            key={section.key}
            section={section}
            onOpenListing={(item) => navigateApp(commerceRoutes.listing(item.slug ?? item.listingId))}
            onMoveToCart={(item) => void handleMoveAlertToCart(item)}
            onRemoveAlert={(item) => void handleRemoveAlert(item)}
          />
        ))}

        {moreSavedSection ? (
          <ListingBrowseView
            title={moreSavedSection.title}
            subtitle={`${moreSavedSection.count} additional saved ${moreSavedSection.count === 1 ? 'item' : 'items'}`}
            items={moreSavedSection.items}
            isLoading={isLoading}
            isLoadingMore={false}
            hasMore={false}
            error={error}
            onLoadMore={() => {}}
            onRetry={() => void loadFavorites()}
            emptyMessage="Your wishlist is empty. Save items with the heart, or move them here from Saved for later on your cart."
            showQuickAdd
          />
        ) : (
          <ListingBrowseView
            title="Saved items"
            subtitle={
              items.length > 0
                ? `${items.length} saved ${items.length === 1 ? 'item' : 'items'}`
                : 'Items you save will appear here'
            }
            items={items}
            isLoading={isLoading}
            isLoadingMore={false}
            hasMore={false}
            error={error}
            onLoadMore={() => {}}
            onRetry={() => void loadFavorites()}
            emptyMessage="Your wishlist is empty. Save items with the heart, or move them here from Saved for later on your cart."
            showQuickAdd
          />
        )}

        {user && items.length > 0 ? (
          <YStack gap="$2" paddingTop="$2">
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              Organize
            </Text>
            {items.slice(0, 20).map((item) => (
              <XStack key={item.id} alignItems="center" gap="$2" justifyContent="space-between">
                <Text flex={1} fontSize={13} color={ui.textSecondary} numberOfLines={1}>
                  {item.title}
                </Text>
                <Button
                  size="$2"
                  tone="outline"
                  borderRadius={999}
                  onPress={() => setMoveListingId(item.id)}
                >
                  Move
                </Button>
              </XStack>
            ))}
          </YStack>
        ) : null}

        <WishlistMoveSheet
          open={!!moveListingId}
          listingId={moveListingId}
          onOpenChange={(open) => {
            if (!open) setMoveListingId(null)
          }}
          onMoved={() => {
            void loadCollections()
            void loadFavorites()
          }}
        />

        {!isLoading && items.length === 0 ? (
          <YStack gap="$3">
            <XStack gap="$2" flexWrap="wrap">
              <AppLink href={commerceRoutes.home} asChild>
                <Button tone="primary" size="$3" borderRadius={999} alignSelf="flex-start">
                  Discover products
                </Button>
              </AppLink>
              <AppLink href={commerceRoutes.cart} asChild>
                <Button tone="outline" size="$3" borderRadius={999} alignSelf="flex-start">
                  View cart
                </Button>
              </AppLink>
              <AppLink href={commerceRoutes.following} asChild>
                <Button tone="outline" size="$3" borderRadius={999} alignSelf="flex-start">
                  Shops you follow
                </Button>
              </AppLink>
            </XStack>
            <RecentlyViewedRail />
          </YStack>
        ) : null}
      </PageSection>
    </FullWidthLayout>
  )
}

function RestockAlertSection({
  section,
  onOpenListing,
  onMoveToCart,
  onRemoveAlert,
}: {
  section: StockAlertSection
  onOpenListing: (item: StockAlertListing) => void
  onMoveToCart: (item: StockAlertListing) => void
  onRemoveAlert: (item: StockAlertListing) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$3">
      <YStack gap={4}>
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          {section.title}
        </Text>
        <Text fontSize={13} color={ui.textMuted}>
          {section.subtitle}
        </Text>
      </YStack>

      {section.items.map((item) => (
        <XStack
          key={item.listingId}
          gap="$3"
          padding="$3.5"
          borderRadius={14}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
        >
          <YStack flex={1} minWidth={220} gap="$1.5">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              {item.title}
            </Text>
            <Text fontSize={12.5} color={ui.textSecondary}>
              {item.shopName ?? 'Shop'} ·{' '}
              {item.state === 'back_in_stock'
                ? `Back in stock${item.stock ? ` · ${item.stock} available` : ''}`
                : item.state === 'inactive'
                  ? 'Listing is still inactive'
                  : 'We are watching for a restock'}
            </Text>
            {item.price ? (
              <Text fontSize={12.5} fontWeight="700" color={ui.brand}>
                {formatCurrency(item.price, item.currency ?? 'INR')}
              </Text>
            ) : null}
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              size="$3"
              tone={item.state === 'back_in_stock' ? 'primary' : 'outline'}
              borderRadius={999}
              onPress={() =>
                item.state === 'back_in_stock' ? onMoveToCart(item) : onOpenListing(item)
              }
            >
              {item.state === 'back_in_stock' ? 'Move to cart' : 'Open listing'}
            </Button>
            <Button
              size="$3"
              tone="outline"
              borderRadius={999}
              icon={<Icons.BellOff size={14} />}
              onPress={() => onRemoveAlert(item)}
            >
              Remove alert
            </Button>
          </XStack>
        </XStack>
      ))}
    </YStack>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  const ui = useAppUi()
  return (
    <YStack
      minWidth={140}
      flex={1}
      gap="$1"
      padding="$3"
      borderRadius={14}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={22} fontWeight="800" color={ui.text}>
        {value}
      </Text>
      <Text fontSize={12} color={ui.textSecondary}>
        {label}
      </Text>
    </YStack>
  )
}
