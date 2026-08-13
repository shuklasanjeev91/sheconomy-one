import { useEffect, useState } from 'react'

import { ListingBrowseView } from '~/commerce/components'
import { resolveSharedWishlist } from '~/commerce/lib/wishlist'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { AppLink } from '~/components/navigation/AppLink'
import { Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { fetchListingsByIds, type ListingSummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type SharedWishlistScreenProps = {
  token: string
}

export function SharedWishlistScreen({ token }: SharedWishlistScreenProps) {
  const ui = useAppUi()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('Shared wishlist')
  const [ownerName, setOwnerName] = useState('A member')
  const [items, setItems] = useState<ListingSummary[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const resolved = await resolveSharedWishlist(token)
      if (cancelled) return
      if (resolved.error || !resolved.payload) {
        setError(
          resolved.error === 'not_found' || resolved.error === 'invalid_token'
            ? 'This wishlist link is invalid or no longer shared.'
            : resolved.error || 'Could not open this wishlist.',
        )
        setItems([])
        setLoading(false)
        return
      }

      setTitle(resolved.payload.name)
      setOwnerName(resolved.payload.ownerName)
      const listings = await fetchListingsByIds(resolved.payload.listingIds)
      if (cancelled) return
      const order = new Map(resolved.payload.listingIds.map((id, index) => [id, index]))
      const sorted = [...listings].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setItems(sorted)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" gap="$4">
        <YStack gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.brand} letterSpacing={0.6}>
            {BRAND_NAME}
          </Text>
          <Text fontSize={24} fontWeight="800" color={ui.text}>
            {title}
          </Text>
          <Text fontSize={14} color={ui.textSecondary}>
            Shared by {ownerName}
            {items.length > 0
              ? ` · ${items.length} item${items.length === 1 ? '' : 's'}`
              : ''}
          </Text>
        </YStack>

        {loading ? (
          <YStack paddingVertical="$10" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack gap="$3" paddingVertical="$6" alignItems="flex-start">
            <Text color={ui.textSecondary}>{error}</Text>
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" borderRadius={999}>
                Browse {BRAND_NAME}
              </Button>
            </AppLink>
          </YStack>
        ) : (
          <>
            <ListingBrowseView
              title="Saved picks"
              subtitle={`${items.length} listing${items.length === 1 ? '' : 's'} on this list`}
              items={items}
              isLoading={false}
              isLoadingMore={false}
              hasMore={false}
              error={null}
              onLoadMore={() => {}}
              onRetry={() => {}}
              emptyMessage="This wishlist is empty right now."
              showQuickAdd
            />
            <XStack gap="$2" flexWrap="wrap">
              <AppLink href={commerceRoutes.home} asChild>
                <Button tone="outline" borderRadius={999}>
                  Discover more
                </Button>
              </AppLink>
              <AppLink href={commerceRoutes.favorites} asChild>
                <Button tone="primary" borderRadius={999}>
                  Start your wishlist
                </Button>
              </AppLink>
            </XStack>
          </>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}
