import { Image, Text, YStack } from '~/components/ui'
import type { ListingAplusModuleRow } from '~/commerce/lib/listing-loader'
import { useAppUi } from '~/lib/theme/useAppUi'

import { SectionTitle } from '~/commerce/components/SectionTitle'

type ListingAplusContentProps = {
  modules: ListingAplusModuleRow[]
}

export function ListingAplusContent({ modules }: ListingAplusContentProps) {
  const ui = useAppUi()
  const visible = [...modules]
    .filter((module) => module.headline?.trim() || module.body?.trim() || module.image_url)
    .sort((a, b) => a.display_order - b.display_order)

  if (!visible.length) return null

  return (
    <YStack gap="$3" width="100%">
      <SectionTitle title="From the maker" />
      {visible.map((module) => {
        const rows =
          module.module_type === 'comparison' && typeof module.payload?.rows === 'string'
            ? module.payload.rows.split('\n').map((line) => line.trim()).filter(Boolean)
            : []
        return (
          <YStack key={module.id} gap="$2" width="100%">
            {module.image_url ? (
              <Image
                src={module.image_url}
                alt={module.headline ?? 'Product detail'}
                width="100%"
                height={220}
                objectFit="cover"
                borderRadius={12}
              />
            ) : null}
            {module.headline?.trim() ? (
              <Text fontSize={18} fontWeight="800" color={ui.text}>
                {module.headline}
              </Text>
            ) : null}
            {module.body?.trim() ? (
              <Text fontSize={14} color={ui.textSecondary} lineHeight={22}>
                {module.body}
              </Text>
            ) : null}
            {rows.map((row) => (
              <Text key={row} fontSize={13} color={ui.text}>
                {row}
              </Text>
            ))}
          </YStack>
        )
      })}
    </YStack>
  )
}
