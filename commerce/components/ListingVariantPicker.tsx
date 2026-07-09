import { ScrollView, Text, XStack, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import type { VariationGroup } from '~/lib/listing-detail'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingVariantPickerProps = {
  groups: VariationGroup[]
  selection: Record<string, string>
  currency: string
  basePrice: number
  onSelect: (groupName: string, variationId: string) => void
}

export function ListingVariantPicker({
  groups,
  selection,
  currency,
  basePrice,
  onSelect,
  variant = 'default',
}: ListingVariantPickerProps & { variant?: 'default' | 'mobile' }) {
  const ui = useAppUi()

  if (!groups.length) return null

  if (variant === 'mobile') {
    return (
      <YStack gap="$4" width="100%">
        {groups.map((group) => (
          <YStack key={group.name} gap="$2" width="100%">
            <Text fontSize={13} color={ui.textMuted} fontWeight="500">
              {group.name}
              {selection[group.name]
                ? `: ${group.options.find((o) => o.id === selection[group.name])?.variation_value ?? ''}`
                : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2" paddingRight="$2">
                {group.options.map((option) => {
                  const isSelected = selection[group.name] === option.id
                  return (
                    <XStack
                      key={option.id}
                      minHeight={44}
                      paddingHorizontal="$3.5"
                      paddingVertical="$2.5"
                      borderRadius={8}
                      borderWidth={isSelected ? 2 : 1}
                      borderColor={isSelected ? ui.text : ui.panelBorder}
                      backgroundColor={ui.surface}
                      cursor="pointer"
                      onPress={() => onSelect(group.name, option.id)}
                      alignItems="center"
                    >
                      <Text fontSize={14} color={ui.text} fontWeight={isSelected ? '600' : '400'}>
                        {option.variation_value}
                      </Text>
                    </XStack>
                  )
                })}
              </XStack>
            </ScrollView>
          </YStack>
        ))}
      </YStack>
    )
  }

  return (
    <YStack gap="$4" width="100%">
      {groups.map((group) => (
        <YStack key={group.name} gap="$2" width="100%">
          <Text fontSize={13} color={ui.text} fontWeight="500">
            {group.name}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {group.options.map((option) => {
              const isSelected = selection[group.name] === option.id
              const adjustment = option.price_adjustment ?? 0
              const optionPrice = basePrice + adjustment

              return (
                <XStack
                  key={option.id}
                  minWidth={72}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={999}
                  borderWidth={isSelected ? 2 : 1}
                  borderColor={isSelected ? ui.text : ui.border}
                  backgroundColor={isSelected ? ui.surface : ui.surfaceMuted}
                  cursor="pointer"
                  onPress={() => onSelect(group.name, option.id)}
                  hoverStyle={{ borderColor: ui.text }}
                >
                  <YStack gap={2}>
                    <Text fontSize={13} color={ui.text} fontWeight={isSelected ? '600' : '400'}>
                      {option.variation_value}
                    </Text>
                    {adjustment !== 0 ? (
                      <Text fontSize={11} color={ui.textSecondary}>
                        {formatCurrency(optionPrice, currency)}
                      </Text>
                    ) : null}
                  </YStack>
                </XStack>
              )
            })}
          </XStack>
        </YStack>
      ))}
    </YStack>
  )
}