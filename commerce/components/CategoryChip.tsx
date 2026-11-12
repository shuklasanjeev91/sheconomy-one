import { useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

import { Text, Skeleton, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import type { CategorySummary } from '~/lib/supabase/commerce'
import { getCategorySlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAppLayout } from '~/hooks/useAppLayout'

import { CategoryImage } from '~/commerce/components/CategoryImage'

/** Portrait category card — home featured + discover rails. */
const PORTRAIT_RATIO = 4 / 3 // height / width

type CategoryChipProps = {
  category: CategorySummary
  /**
   * `featured` — large home category tile (fills parent width when flex).
   * `discover` — denser horizontal rail tile.
   */
  variant?: 'featured' | 'discover'
  /** Fixed width; when omitted, featured fills parent and discover uses layout size. */
  width?: number
}

function useDiscoverTileWidth(override?: number) {
  const { isDesktop, isTablet } = useAppLayout()
  if (override != null) return override
  if (isDesktop) return 196
  if (isTablet) return 172
  return 148
}

/** Storefront category portrait card for home discovery rails. */
export function CategoryChip({
  category,
  variant = 'discover',
  width: widthProp,
}: CategoryChipProps) {
  const ui = useAppUi()
  const discoverWidth = useDiscoverTileWidth(widthProp)
  const [measuredWidth, setMeasuredWidth] = useState(0)

  const isFeatured = variant === 'featured'
  const width = isFeatured
    ? widthProp && widthProp > 0
      ? widthProp
      : measuredWidth
    : discoverWidth
  const height = width > 0 ? Math.round(width * PORTRAIT_RATIO) : 0
  const label =
    category.category.length > (isFeatured ? 40 : 28)
      ? `${category.category.slice(0, isFeatured ? 38 : 26)}…`
      : category.category

  function handleLayout(event: LayoutChangeEvent) {
    if (!isFeatured || widthProp) return
    const next = Math.round(event.nativeEvent.layout.width)
    if (next > 0 && next !== measuredWidth) setMeasuredWidth(next)
  }

  return (
    <AppLink href={commerceRoutes.category(getCategorySlug(category))} asChild>
      <YStack
        width={isFeatured && !widthProp ? '100%' : width || discoverWidth}
        flex={isFeatured && !widthProp ? 1 : undefined}
        minWidth={isFeatured && !widthProp ? 0 : undefined}
        alignItems="center"
        gap="$2.5"
        cursor="pointer"
        animation="quick"
        hoverStyle={{ y: -4, opacity: 0.97 }}
        pressStyle={{ scale: 0.985, y: 0 }}
        onLayout={handleLayout}
      >
        <YStack
          width="100%"
          height={height || undefined}
          aspectRatio={height ? undefined : 3 / 4}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {width > 0 && height > 0 ? (
            <CategoryImage
              src={category.category_image_url}
              icon={category.category_icon}
              width={width}
              height={height}
              alt={category.category}
            />
          ) : null}
        </YStack>
        <Text
          fontSize={isFeatured ? 15 : 13}
          fontWeight="600"
          textAlign="center"
          numberOfLines={2}
          lineHeight={isFeatured ? 20 : 17}
          color={ui.text}
          width="100%"
          letterSpacing={-0.15}
          paddingHorizontal="$1"
        >
          {label}
        </Text>
      </YStack>
    </AppLink>
  )
}

/** Compact text pill for marketplace home discovery rails. */
export function CategoryPillChip({ category }: CategoryChipProps) {
  const ui = useAppUi()
  const label =
    category.category.length > 22
      ? `${category.category.slice(0, 20)}…`
      : category.category

  return (
    <AppLink href={commerceRoutes.category(getCategorySlug(category))} asChild>
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3.5"
        paddingVertical={10}
        borderRadius={999}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        cursor="pointer"
        animation="quick"
        hoverStyle={{ borderColor: ui.brand, backgroundColor: ui.roseSurface }}
        pressStyle={{ scale: 0.97, opacity: 0.9 }}
      >
        <YStack
          width={28}
          height={28}
          borderRadius={999}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          flexShrink={0}
        >
          <CategoryImage
            src={category.category_image_url}
            icon={category.category_icon}
            width={28}
            height={28}
            alt={category.category}
          />
        </YStack>
        <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
          {label}
        </Text>
      </XStack>
    </AppLink>
  )
}

export function CategoryPillChipSkeleton() {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3.5"
      paddingVertical={10}
      borderRadius={999}
    >
      <Skeleton width={28} height={28} borderRadius={999} />
      <Skeleton width={72} height={12} borderRadius={4} />
    </XStack>
  )
}

export function CategoryChipSkeleton({
  variant = 'discover',
  width: widthProp,
}: {
  variant?: 'featured' | 'discover'
  width?: number
} = {}) {
  const discoverWidth = useDiscoverTileWidth(widthProp)
  const width = variant === 'featured' ? widthProp || discoverWidth * 1.35 : discoverWidth
  const height = Math.round(width * PORTRAIT_RATIO)

  return (
    <YStack
      width={variant === 'featured' && !widthProp ? '100%' : width}
      flex={variant === 'featured' && !widthProp ? 1 : undefined}
      minWidth={0}
      alignItems="center"
      gap="$2.5"
    >
      <Skeleton width="100%" height={height} borderRadius={12} />
      <Skeleton width="70%" height={14} borderRadius={4} />
    </YStack>
  )
}

export function CategoryRailSkeleton({
  count = 4,
  variant = 'featured',
}: {
  count?: number
  variant?: 'featured' | 'discover'
}) {
  if (variant === 'featured') {
    return (
      <XStack gap={16} width="100%">
        {Array.from({ length: count }).map((_, index) => (
          <CategoryChipSkeleton key={index} variant="featured" />
        ))}
      </XStack>
    )
  }

  return (
    <XStack gap={16} paddingRight="$5">
      {Array.from({ length: count }).map((_, index) => (
        <CategoryChipSkeleton key={index} variant="discover" />
      ))}
    </XStack>
  )
}

export function CategoryPillRailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <XStack gap="$2" paddingRight="$5">
      {Array.from({ length: count }).map((_, index) => (
        <CategoryPillChipSkeleton key={index} />
      ))}
    </XStack>
  )
}
