import { Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BLOG_SORT_OPTIONS } from '~/blog/lib/blog-utils'

/** Simple sort chips — avoids Tamagui Select edge cases on the public blog page. */
export function BlogSortSelect({
  value,
  onSort,
}: {
  value: string
  onSort: (value: string) => void
}) {
  const ui = useAppUi()

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center">
      {BLOG_SORT_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <YStack
            key={opt.value}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={radius.pill}
            borderWidth={1}
            borderColor={active ? ui.brand : ui.borderSubtle}
            backgroundColor={active ? ui.brand : ui.surface}
            cursor="pointer"
            onPress={() => onSort(opt.value)}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={12} fontWeight="700" color={active ? ui.onBrand : ui.textSecondary}>
              {opt.label}
            </Text>
          </YStack>
        )
      })}
    </XStack>
  )
}
