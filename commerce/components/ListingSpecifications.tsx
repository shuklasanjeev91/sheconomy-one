import { Separator, Text, XStack, YStack } from '~/components/ui'
import type { ListingSpecification } from '~/lib/listing-detail'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingSpecificationsProps = {
  specifications: ListingSpecification[]
}

export function ListingSpecifications({ specifications }: ListingSpecificationsProps) {
  const ui = useAppUi()

  if (!specifications.length) return null

  return (
    <YStack gap="$3" width="100%">
      <Text fontWeight="500" fontSize={18} color={ui.text} letterSpacing={-0.2}>
        Item details
      </Text>
      <YStack
        width="100%"
        borderWidth={1}
        borderColor={ui.panelBorder}
        borderRadius={8}
        overflow="hidden"
        backgroundColor={ui.surface}
      >
        {specifications.map((spec, index) => (
          <YStack key={`${spec.label}-${spec.value}`}>
            <XStack
              width="100%"
              gap="$4"
              paddingHorizontal="$4"
              paddingVertical="$3"
              alignItems="flex-start"
            >
              <Text
                width="38%"
                maxWidth={220}
                fontSize={13}
                color={ui.textSecondary}
                fontWeight="500"
                flexShrink={0}
              >
                {spec.label}
              </Text>
              <Text flex={1} fontSize={13} color={ui.text} lineHeight={20}>
                {spec.value}
              </Text>
            </XStack>
            {index < specifications.length - 1 ? <Separator borderColor={ui.panelBorder} /> : null}
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}