import { useParams } from 'one'
import { useEffect, useMemo, useState } from 'react'

import { Spinner, Text, YStack } from '~/components/ui'
import { ListingBrowseView, ListingFiltersShell, CommercePageHeader } from '~/commerce/components'
import { useSponsoredCommerce } from '~/commerce/hooks/useSponsoredCommerce'
import { useCategoryFilterFacets } from '~/commerce/hooks/useCategoryFilterFacets'
import { useCategoryListings } from '~/commerce/hooks/useCategoryListings'
import type { CategoryLoaderResult } from '~/commerce/lib/category-loader'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import { fetchCategoryBySlug, getCategorySlug, type CategorySummary } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { replaceApp } from '~/lib/platform/navigate'

export function CategoryScreen({
  filters: initialFilters = {},
  initial,
}: {
  filters?: ListingBrowseFilters
  initial?: CategoryLoaderResult | null
}) {
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const filters = initialFilters
  const hasInitial = Boolean(initial?.category || initial?.error)
  const [category, setCategory] = useState<CategorySummary | null>(initial?.category ?? null)
  const [categoryError, setCategoryError] = useState<string | null>(initial?.error ?? null)
  const [isCategoryLoading, setIsCategoryLoading] = useState(!hasInitial)

  useEffect(() => {
    if (!slug) return
    if (initial?.category || initial?.error) {
      setCategory(initial.category)
      setCategoryError(initial.error)
      setIsCategoryLoading(false)
      return
    }

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
  }, [slug, initial?.category, initial?.error])

  const listingsFeed = useCategoryListings({
    categoryId: category?.category_id,
    filters,
    enabled: !!category?.category_id,
  })
  const sponsored = useSponsoredCommerce({
    placement: 'commerce_browse',
    context: { category_id: category?.category_id },
    enabled: !!category?.category_id,
    limit: 2,
  })
  const { facets, isLoading: facetsLoading } = useCategoryFilterFacets(category?.category_id)

  const filterKey = useMemo(() => JSON.stringify(filters), [filters])

  usePageSeo(
    useMemo(() => {
      if (!category) return null
      const name = category.seo_name || category.category
      return {
        title: name,
        description: `Shop ${name} from women-led businesses on SHEconomy.`,
        image: category.category_image_url,
      }
    }, [category]),
  )

  function updateFilters(next: ListingBrowseFilters) {
    if (!category) return
    const params = buildFilterSearchParams(new URLSearchParams(), next)
    const search = params.toString()
    const base = commerceRoutes.category(getCategorySlug(category))
    replaceApp((search ? `${base}?${search}` : base) as never)
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
        <YStack gap="$4" width="100%">
          <CommercePageHeader
            title={category.category}
            subtitle={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          />
          <ListingFiltersShell
            filters={filters}
            onApply={updateFilters}
            facets={facets}
            facetsLoading={facetsLoading}
            inventoryDriven
            sortInToolbar
            showTypeFilter={false}
          >
            <ListingBrowseView
              key={filterKey}
              hideHeader
              title={category.category}
              items={listingsFeed.items}
              isLoading={listingsFeed.isLoading}
              isLoadingMore={listingsFeed.isLoadingMore}
              hasMore={listingsFeed.hasMore}
              error={listingsFeed.error}
              onLoadMore={listingsFeed.loadMore}
              onRetry={listingsFeed.refresh}
              emptyMessage={`No listings in ${category.category} yet.`}
              sponsoredItems={sponsored.items}
              onSponsoredEvent={(item, event) => void sponsored.track(item, event)}
            />
          </ListingFiltersShell>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
