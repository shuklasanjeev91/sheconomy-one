import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useNetwork } from '~/community/hooks/useNetwork'
import { filterNetworkSuggestions } from '~/community/lib/network-suggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  dismissNetworkSuggestion,
  useDismissedNetworkSuggestions,
} from '~/community/lib/dismissed-suggestions'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

const SUGGESTION_LIMIT = 4

export function NetworkSuggestionsStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips, isAuthenticated } = useCommunityFeedHeader()
  const network = useNetwork()
  const dismissedIds = useDismissedNetworkSuggestions()
  const suggestions = filterNetworkSuggestions(network.suggestions, dismissedIds, SUGGESTION_LIMIT)

  if (hideSidebarRedundantStrips) return null
  if (!isAuthenticated) return null
  if (suggestions.length === 0) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            People you may know
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Grow your network with founders and creators matched to your profile.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.network} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {suggestions.map((member) => (
          <YStack
            key={member.user_id}
            width={188}
            padding={12}
            gap={10}
            borderRadius={14}
            borderWidth={1}
            borderColor={communityUi.border}
            backgroundColor={communityUi.pageBg}
          >
            <XStack gap={10} alignItems="center">
              <ProfileLink userId={member.user_id} username={member.username}>
                <Avatar name={member.full_name} src={member.avatar_url ?? undefined} size="$4" />
              </ProfileLink>
              <YStack flex={1} minWidth={0} gap={2}>
                <ProfileLink userId={member.user_id} username={member.username}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                    {member.full_name}
                  </Text>
                </ProfileLink>
                {member.headline || member.industry ? (
                  <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                    {member.headline || member.industry}
                  </Text>
                ) : null}
              </YStack>
              <XStack
                onPress={() => dismissNetworkSuggestion(member.user_id)}
                cursor="pointer"
                padding={4}
                hitSlop={8}
              >
                <Icons.X size={14} color={communityUi.textMuted} />
              </XStack>
            </XStack>
            {member.mutual_count > 0 ? (
              <Text fontSize={11} color={communityUi.textMuted}>
                {member.mutual_count} mutual connection{member.mutual_count === 1 ? '' : 's'}
              </Text>
            ) : null}
            <ProfileConnectButton targetUserId={member.user_id} size="sm" fullWidth />
          </YStack>
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
