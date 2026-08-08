import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { CmsTag } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BlogTagFilter({
  tags,
  activeTags,
  onToggle,
}: {
  tags: CmsTag[]
  activeTags: string[]
  onToggle: (tagId: string) => void
}) {
  const ui = useAppUi()
  if (!tags.length) return null

  return (
    <YStack gap="$2.5">
      <XStack alignItems="center" gap="$2">
        <Icons.Tag size={14} color={ui.textMuted} />
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          Filter by tags
        </Text>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {tags.map((tag) => {
          const active = activeTags.includes(tag.id)
          return (
            <YStack
              key={tag.id}
              paddingHorizontal="$3"
              paddingVertical="$1.5"
              borderRadius={radius.pill}
              borderWidth={1}
              borderColor={active ? ui.brand : ui.borderSubtle}
              backgroundColor={active ? ui.roseSurface : ui.surfaceMuted}
              cursor="pointer"
              onPress={() => onToggle(tag.id)}
              pressStyle={{ opacity: 0.9 }}
            >
              <Text fontSize={12} fontWeight="600" color={active ? ui.brand : ui.textMuted}>
                #{tag.name}
              </Text>
            </YStack>
          )
        })}
      </XStack>
    </YStack>
  )
}
