import { AppLink } from '~/components/navigation/AppLink'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'
import type { SearchHit } from '~/lib/search'
import { SEARCH_HIT_KIND_LABELS } from '~/lib/search'
import { useAppUi } from '~/lib/theme/useAppUi'

type SearchHitRowProps = {
  hit: SearchHit
  onPress?: () => void
}

const AVATAR_KINDS = new Set<SearchHit['kind']>(['person', 'company', 'shop', 'group'])

export function SearchHitRow({ hit, onPress }: SearchHitRowProps) {
  const ui = useAppUi()
  const kindLabel = SEARCH_HIT_KIND_LABELS[hit.kind]

  return (
    <AppLink href={hit.href as import('one').Href} asChild>
      <XStack
        gap="$3"
        alignItems="center"
        paddingVertical="$2.5"
        paddingHorizontal="$3"
        borderRadius={12}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
        width="100%"
      >
        {AVATAR_KINDS.has(hit.kind) ? (
          <Avatar name={hit.title} src={hit.imageUrl ?? undefined} size="$4" />
        ) : hit.imageUrl ? (
          <Image
            src={hit.imageUrl}
            width={44}
            height={44}
            borderRadius={10}
            objectFit="cover"
            alt=""
            backgroundColor={ui.surfaceMuted}
          />
        ) : (
          <YStack
            width={44}
            height={44}
            borderRadius={10}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
              {kindLabel.slice(0, 1)}
            </Text>
          </YStack>
        )}

        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={14} fontWeight="600" color={ui.text} numberOfLines={1}>
            {hit.title}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
            {hit.subtitle || kindLabel}
          </Text>
        </YStack>

        <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
          {kindLabel}
        </Text>
      </XStack>
    </AppLink>
  )
}
