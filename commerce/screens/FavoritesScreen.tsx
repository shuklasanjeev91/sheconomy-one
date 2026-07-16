import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { ListingBrowseView, RecentlyViewedRail } from '~/commerce/components'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { BRAND_NAME } from '~/config/brand'
import { formatCurrency } from '~/lib/format'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function FavoritesScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { favoriteIds, isLoading: isFavoritesLoading } = useFavorites()
  const [items, setItems] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function handleShareWishlist() {
    if (!items.length) {
      toast.show('Save items before sharing', { tone: 'info' })
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

  const loadFavorites = useCallback(async () => {
    if (!favoriteIds.length) {
      setItems([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    try {
      const listings = await fetchListingsByIds(favoriteIds)
      const order = new Map(favoriteIds.map((id, index) => [id, index]))
      const sorted = [...listings].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      )
      setItems(sorted)
      setError(null)
    } catch {
      setError('Could not load your favorites.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [favoriteIds])

  useEffect(() => {
    if (isFavoritesLoading) return
    void loadFavorites()
  }, [isFavoritesLoading, loadFavorites])

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
                : 'Items you save will appear here'}
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
          emptyMessage="Your wishlist is empty."
          showQuickAdd
        />

        {!isLoading && items.length === 0 ? (
          <YStack gap="$3">
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" size="$3" borderRadius={999} alignSelf="flex-start">
                Discover products
              </Button>
            </AppLink>
            <RecentlyViewedRail />
          </YStack>
        ) : null}
      </PageSection>
    </FullWidthLayout>
  )
}
