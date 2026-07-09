import { useParams, useRouter } from 'one'
import { useEffect, useMemo, useState } from 'react'

import { Icons, Image, Spinner, Text, YStack } from '~/components/ui'
import { ListingBrowseView, ListingFiltersShell } from '~/commerce/components'
import { useCategoryFilterFacets } from '~/commerce/hooks/useCategoryFilterFacets'
import { useCategoryListings } from '~/commerce/hooks/useCategoryListings'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import { fetchCategoryBySlug, getCategorySlug, type CategorySummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CategoryScreen({ filters: initialFilters = {} }: { filters?: ListingBrowseFilters }) {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const filters = initialFilters
  const [category, setCategory] = useState<CategorySummary | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [isCategoryLoading, setIsCategoryLoading] = useState(true)

  useEffect(() => {
    if (!slug) return

    let active = true
    setIsCategoryLoading(true)
    fetchCategoryBySlug(slug).then(({ data, error }) => {
      if (!active) return
      setCategory(data)
      setCategoryError(error)
      setIsCategoryLoading(false)
    })

    return () => {
      active = false
    }
  }, [slug])

  const listingsFeed = useCategoryListings({
    categoryId: category?.category_id,
    filters,
    enabled: !!category?.category_id,
  })
  const { facets, isLoading: facetsLoading } = useCategoryFilterFacets(category?.category_id)

  const filterKey = useMemo(() => JSON.stringify(filters), [filters])

  function updateFilters(next: ListingBrowseFilters) {
    if (!category) return
    const params = buildFilterSearchParams(new URLSearchParams(), next)
    const search = params.toString()
    const base = commerceRoutes.category(getCategorySlug(category))
    router.replace((search ? `${base}?${search}` : base) as never)
  }

  if (isCategoryLoading) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (categoryError || !category) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8">
          <YStack gap="$3">
            <Text fontWeight="500" fontSize={22} color={ui.text}>
              Category not found
            </Text>
            <Text color={ui.textSecondary}>{categoryError ?? 'This category could not be loaded.'}</Text>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const itemCount = category.product_count ?? listingsFeed.items.length

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%">
          <ListingFiltersShell
            filters={filters}
            onApply={updateFilters}
            facets={facets}
            facetsLoading={facetsLoading}
            inventoryDriven
            showTypeFilter={false}
          >
            <ListingBrowseView
            key={filterKey}
            title={category.category}
          subtitle={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          header={
            <YStack gap="$4">
              <YStack
                width={96}
                height={96}
                borderRadius={999}
                overflow="hidden"
                backgroundColor={ui.imagePlaceholder}
                alignItems="center"
                justifyContent="center"
              >
                {category.category_image_url ? (
                  <Image
                    src={category.category_image_url}
                    width={96}
                    height={96}
                    objectFit="cover"
                  />
                ) : (
                  <Icons.LayoutGrid size={32} color={ui.textSecondary} />
                )}
              </YStack>
              <YStack gap="$1">
                <Text fontWeight="500" fontSize={28} color={ui.text} letterSpacing={-0.4}>
                  {category.category}
                </Text>
                <Text color={ui.textMuted} fontSize={14}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
              </YStack>
            </YStack>
          }
          items={listingsFeed.items}
          isLoading={listingsFeed.isLoading}
          isLoadingMore={listingsFeed.isLoadingMore}
          hasMore={listingsFeed.hasMore}
          error={listingsFeed.error}
          onLoadMore={listingsFeed.loadMore}
          emptyMessage={`No listings in ${category.category} yet.`}
        />
          </ListingFiltersShell>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}