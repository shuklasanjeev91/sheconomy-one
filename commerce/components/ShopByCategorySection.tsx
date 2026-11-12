import { useEffect } from 'react'

import { Text, XStack, YStack } from '~/components/ui'
import type { CategorySummary } from '~/lib/supabase/commerce'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import {
  CategoryChip,
  CategoryChipSkeleton,
  CategoryRailSkeleton,
} from '~/commerce/components/CategoryChip'
import { InfiniteHorizontalSection } from '~/commerce/components/InfiniteHorizontalSection'

const FEATURED_COUNT = 4

type ShopByCategorySectionProps = {
  categories: CategorySummary[]
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

function SectionHeading({ title }: { title: string }) {
  const ui = useAppUi()
  return (
    <Text
      fontWeight="800"
      fontSize={26}
      color={ui.text}
      letterSpacing={-0.55}
      lineHeight={32}
    >
      {title}
    </Text>
  )
}

/** Featured category row — 4 equal portrait cards on wide screens. */
function FeaturedCategoryRow({ categories }: { categories: CategorySummary[] }) {
  const { isDesktop, isTablet } = useAppLayout()
  const fillRow = isDesktop || isTablet
  const featured = categories.slice(0, FEATURED_COUNT)

  if (fillRow) {
    return (
      <XStack gap={16} width="100%" alignItems="flex-start">
        {featured.map((category) => (
          <CategoryChip key={category.category_id} category={category} variant="featured" />
        ))}
      </XStack>
    )
  }

  return (
    <InfiniteHorizontalSection
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={() => {}}
      gap={14}
    >
      {featured.map((category) => (
        <CategoryChip
          key={category.category_id}
          category={category}
          variant="discover"
          width={168}
        />
      ))}
    </InfiniteHorizontalSection>
  )
}

/**
 * Home category discovery: large featured portrait row, then a denser
 * horizontal rail for additional categories.
 */
export function ShopByCategorySection({
  categories,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: ShopByCategorySectionProps) {
  // Keep the denser rail filled — featured consumes the first four tiles.
  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore) return
    if (categories.length > 0 && categories.length <= FEATURED_COUNT) {
      onLoadMore()
    }
  }, [categories.length, hasMore, isLoading, isLoadingMore, onLoadMore])

  if (categories.length === 0) {
    if (!isLoading) return null
    return (
      <YStack gap="$6" width="100%">
        <YStack gap="$4" width="100%">
          <SectionHeading title="Shop by category" />
          <CategoryRailSkeleton count={4} variant="featured" />
        </YStack>
      </YStack>
    )
  }

  const featured = categories.slice(0, FEATURED_COUNT)
  const discover = categories.slice(FEATURED_COUNT)
  const showDiscover = discover.length > 0 || isLoadingMore

  return (
    <YStack gap="$7" width="100%">
      <YStack gap="$4" width="100%">
        <SectionHeading title="Shop by category" />
        <FeaturedCategoryRow categories={featured} />
      </YStack>

      {showDiscover ? (
        <YStack gap="$4" width="100%">
          <SectionHeading title="Explore more categories" />
          <InfiniteHorizontalSection
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
            gap={16}
            loadMorePlaceholder={
              <>
                <CategoryChipSkeleton variant="discover" />
                <CategoryChipSkeleton variant="discover" />
                <CategoryChipSkeleton variant="discover" />
              </>
            }
          >
            {discover.map((category) => (
              <CategoryChip
                key={category.category_id}
                category={category}
                variant="discover"
              />
            ))}
          </InfiniteHorizontalSection>
        </YStack>
      ) : null}
    </YStack>
  )
}
