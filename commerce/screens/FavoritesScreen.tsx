import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { ListingBrowseView, RecentlyViewedRail } from '~/commerce/components'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import {
  createWishlistCollection,
  ensureWishlistShareLink,
  fetchWishlistCollections,
  fetchWishlistListingIdsInCollection,
  type WishlistCollection,
} from '~/commerce/lib/wishlist'
import { WishlistMoveSheet } from '~/commerce/components/WishlistMoveSheet'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { BRAND_NAME } from '~/config/brand'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function FavoritesScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { favoriteIds, isLoading: isFavoritesLoading } = useFavorites()
  const [items, setItems] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collections, setCollections] = useState<WishlistCollection[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [moveListingId, setMoveListingId] = useState<string | null>(null)

  async function handleShareWishlist() {
    if (!items.length) {
      toast.show('Save items before sharing', { tone: 'info' })
      return
    }

    if (user?.id) {
      const result = await ensureWishlistShareLink({
        userId: user.id,
        collectionId: activeCollectionId,
        listingIds: items.map((item) => item.id),
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

    const lines = items.slice(0, 12).map((item) => {
      const price =
        typeof item.price === 'number'
          ? ` — ${formatCurrency(item.price, item.currency ?? 'INR')}`
          : ''
      return `• ${item.title}${price}`
    })
    const message = [
      `Wishlist on ${BRAND_NAME}`,
      `${items.length} saved item${items.length === 1 ? '' : 's'}`,
      '',
      ...lines,
      items.length > 12 ? `…and ${items.length - 12} more` : null,
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
    if (isFavoritesLoading) return
    void loadFavorites()
  }, [isFavoritesLoading, loadFavorites])

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
              {items.length > 0
                ? `${items.length} saved ${items.length === 1 ? 'item' : 'items'}`
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
