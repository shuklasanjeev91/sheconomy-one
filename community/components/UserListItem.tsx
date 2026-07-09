import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { UserListMember } from '~/community/lib/user-lists'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

type UserListItemProps = {
  member: UserListMember
  showConnect?: boolean
  showFollow?: boolean
  compact?: boolean
}

export function UserListItem({
  member,
  showConnect = true,
  showFollow = true,
  compact = false,
}: UserListItemProps) {
  const communityUi = useCommunityUi()
  const subtitle = member.headline || member.industry || member.location

  return (
    <XStack
      gap={12}
      alignItems={compact ? 'center' : 'flex-start'}
      paddingVertical={compact ? 8 : 12}
      paddingHorizontal={8}
      borderRadius={8}
      borderBottomWidth={1}
      borderBottomColor={communityUi.borderLight}
      hoverStyle={{ backgroundColor: communityUi.divider }}
    >
      <ProfileLink userId={member.user_id} username={member.username}>
        <Avatar
          name={member.full_name}
          src={member.avatar_url ?? undefined}
          size={compact ? '$4' : '$5'}
          cursor="pointer"
        />
      </ProfileLink>

      <YStack flex={1} gap={4} minWidth={0}>
        <ProfileLink userId={member.user_id} username={member.username}>
          <XStack gap={4} alignItems="center" flexWrap="wrap">
            <Text
              fontSize={compact ? 14 : 16}
              fontWeight="600"
              color={communityUi.text}
              numberOfLines={1}
              cursor="pointer"
              hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
            >
              {member.full_name}
            </Text>
            {member.is_verified ? (
              <Text fontSize={11} color={communityUi.brand} fontWeight="700">
                ✓
              </Text>
            ) : null}
          </XStack>
        </ProfileLink>

        {subtitle ? (
          <Text fontSize={compact ? 12 : 14} color={communityUi.textMuted} numberOfLines={2} lineHeight={18}>
            {subtitle}
          </Text>
        ) : null}

        {member.mutual_count > 0 ? (
          <XStack gap={4} alignItems="center">
            <Icons.Users size={12} color={communityUi.textMuted} />
            <Text fontSize={12} color={communityUi.textMuted}>
              {member.mutual_count} mutual connection{member.mutual_count === 1 ? '' : 's'}
            </Text>
          </XStack>
        ) : null}
      </YStack>

      <XStack gap={8} flexShrink={0} alignItems="center">
        {showFollow ? <ProfileFollowButton targetUserId={member.user_id} size="sm" /> : null}
        {showConnect ? <ProfileConnectButton targetUserId={member.user_id} size="sm" /> : null}
      </XStack>
    </XStack>
  )
}