import { Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { CmsCategory } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BlogCategoryFilter({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: CmsCategory[]
  activeCategory: string
  onSelect: (id: string) => void
}) {
  const ui = useAppUi()

  function Pill({
    label,
    active,
    onPress,
  }: {
    label: string
    active: boolean
    onPress: () => void
  }) {
    return (
      <YStack
        paddingHorizontal="$3.5"
        paddingVertical="$2"
        borderRadius={radius.pill}
        borderWidth={1}
        borderColor={active ? ui.brand : ui.borderSubtle}
        backgroundColor={active ? ui.brand : ui.surface}
        cursor="pointer"
        onPress={onPress}
        pressStyle={{ opacity: 0.9 }}
      >
        <Text fontSize={13} fontWeight="700" color={active ? ui.onBrand : ui.textSecondary}>
          {label}
        </Text>
      </YStack>
    )
  }

  return (
    <XStack gap="$2" flexWrap="wrap">
      <Pill label="All" active={!activeCategory} onPress={() => onSelect('')} />
      {categories.map((cat) => (
        <Pill
          key={cat.id}
          label={cat.name}
          active={activeCategory === cat.id}
          onPress={() => onSelect(cat.id)}
        />
      ))}
    </XStack>
  )
}
