import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { NetworkMember } from '~/community/lib/network'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

type MemberRowProps = {
  member: NetworkMember
  compact?: boolean
  showConnect?: boolean
  onDismiss?: () => void
}

export function MemberRow({
  member,
  compact = false,
  showConnect = true,
  onDismiss,
}: MemberRowProps) {
  const communityUi = useCommunityUi()
  const subtitle = member.headline || member.industry || member.location

  return (
    <XStack
      gap="$3"
      alignItems={compact ? 'center' : 'flex-start'}
      paddingVertical={compact ? '$2' : '$3'}
      paddingHorizontal={compact ? 0 : '$1'}
      borderRadius={8}
      borderBottomWidth={compact ? 0 : 1}
      borderBottomColor={communityUi.borderLight}
      cursor="default"
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
          <XStack gap={4} alignItems="center">
            <Text
              fontSize={compact ? 14 : 16}
              fontWeight="600"
              color={communityUi.text}
              numberOfLines={1}
              cursor="pointer"
              hoverStyle={{ textDecorationLine: 'underline', color: communityUi.brand }}
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

      {showConnect ? (
        <ProfileConnectButton targetUserId={member.user_id} size={compact ? 'sm' : 'md'} />
      ) : null}

      {onDismiss ? (
        <XStack
          onPress={onDismiss}
          cursor="pointer"
          padding={6}
          borderRadius={999}
          pressStyle={{ opacity: 0.7 }}
          hitSlop={8}
          aria-label="Dismiss suggestion"
        >
          <Icons.X size={16} color={communityUi.textMuted} />
        </XStack>
      ) : null}
    </XStack>
  )
}