import { Link } from 'one'

import { Icons, Image, Text, YStack } from '~/components/ui'
import type { CategorySummary } from '~/lib/supabase/commerce'
import { getCategorySlug } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const CIRCLE_SIZE = 84

type CategoryChipProps = {
  category: CategorySummary
}

/** Etsy category circle — photo in a round frame with label beneath. */
export function CategoryChip({ category }: CategoryChipProps) {
  const ui = useAppUi()
  const label =
    category.category.length > 18
      ? `${category.category.slice(0, 16)}…`
      : category.category

  return (
    <Link href={commerceRoutes.category(getCategorySlug(category))} asChild>
      <YStack
        width={100}
        alignItems="center"
        gap="$2"
        cursor="pointer"
        animation="quick"
        hoverStyle={{ opacity: 0.85 }}
        pressStyle={{ scale: 0.97 }}
      >
        <YStack
          width={CIRCLE_SIZE}
          height={CIRCLE_SIZE}
          borderRadius={999}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {category.category_image_url ? (
            <Image
              src={category.category_image_url}
              width={CIRCLE_SIZE}
              height={CIRCLE_SIZE}
              objectFit="cover"
            />
          ) : (
            <Icons.LayoutGrid size={28} color={ui.textSecondary} />
          )}
        </YStack>
        <Text
          fontSize={12}
          fontWeight="500"
          textAlign="center"
          numberOfLines={2}
          lineHeight={16}
          color={ui.text}
          width="100%"
        >
          {label}
        </Text>
        {category.product_count ? (
          <Text fontSize={11} color={ui.textMuted} textAlign="center">
            {category.product_count} {category.product_count === 1 ? 'item' : 'items'}
          </Text>
        ) : null}
      </YStack>
    </Link>
  )
}