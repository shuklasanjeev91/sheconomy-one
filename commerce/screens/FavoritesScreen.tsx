import { useCallback, useEffect, useState } from 'react'

import { Spinner, Text, YStack } from '~/components/ui'
import { ListingBrowseView } from '~/commerce/components'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { FullWidthLayout, PageSection } from '~/components/layout'

export function FavoritesScreen() {
  const { favoriteIds, isLoading: isFavoritesLoading } = useFavorites()
  const [items, setItems] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <PageSection paddingVertical="$6">
        <ListingBrowseView
          title="Your wishlist"
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
      </PageSection>
    </FullWidthLayout>
  )
}