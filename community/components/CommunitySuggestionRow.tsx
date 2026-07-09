import { Link } from 'one'

import type { CommunitySuggestion, SuggestionKind } from '~/community/lib/community-personalization'
import { suggestionKindLabel } from '~/community/lib/community-personalization'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

const KIND_ICON: Record<SuggestionKind, typeof Icons.User> = {
  person: Icons.User,
  listing: Icons.ShoppingBag,
  shop: Icons.Store,
  company: Icons.Building2,
  group: Icons.UsersRound,
  job: Icons.Briefcase,
  event: Icons.Calendar,
}

const KIND_COLOR: Record<SuggestionKind, string> = {
  person: '#1877f2',
  listing: '#f02849',
  shop: '#42b72a',
  company: '#0a66c2',
  group: '#14b8a6',
  job: '#e67e22',
  event: '#8b5cf6',
}

export function CommunitySuggestionRow({
  item,
  showKindLabel = true,
}: {
  item: CommunitySuggestion
  showKindLabel?: boolean
}) {
  const communityUi = useCommunityUi()
  const Icon = KIND_ICON[item.kind]

  return (
    <Link href={item.href as never}>
      <XStack
        gap={10}
        alignItems="center"
        paddingVertical={8}
        paddingHorizontal={8}
        borderRadius={8}
        cursor="pointer"
        hoverStyle={{ backgroundColor: communityUi.divider }}
      >
        {item.imageUrl ? (
          <Avatar name={item.title} src={item.imageUrl} size="$3" />
        ) : (
          <XStack
            width={36}
            height={36}
            borderRadius={999}
            backgroundColor={KIND_COLOR[item.kind]}
            alignItems="center"
            justifyContent="center"
          >
            <Icon size={16} color="white" />
          </XStack>
        )}

        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={1}>
            {item.title}
          </Text>
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
            {item.subtitle}
          </Text>
          <Text fontSize={11} color={communityUi.brand} numberOfLines={1}>
            {showKindLabel ? `${item.reason} · ${suggestionKindLabel(item.kind)}` : item.reason}
          </Text>
        </YStack>
      </XStack>
    </Link>
  )
}