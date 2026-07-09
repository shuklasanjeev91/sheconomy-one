import { useMemo, useState } from 'react'

import { UserListItem } from '~/community/components/UserListItem'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { UserListMember } from '~/community/lib/user-lists'
import { Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'

type UserListProps = {
  items: UserListMember[]
  isLoading?: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  emptyMessage?: string
  showConnect?: boolean
  showFollow?: boolean
  searchable?: boolean
  onLoadMore?: () => void
}

export function UserList({
  items,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  emptyMessage = 'No people to show.',
  showConnect = true,
  showFollow = true,
  searchable = true,
  onLoadMore,
}: UserListProps) {
  const communityUi = useCommunityUi()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return items

    return items.filter(
      (member) =>
        member.full_name.toLowerCase().includes(trimmed) ||
        (member.username?.toLowerCase().includes(trimmed) ?? false) ||
        (member.headline?.toLowerCase().includes(trimmed) ?? false),
    )
  }, [items, query])

  if (isLoading) {
    return (
      <YStack alignItems="center" paddingVertical="$8">
        <Spinner size="large" color={communityUi.brand} />
      </YStack>
    )
  }

  return (
    <YStack gap="$3" width="100%">
      {searchable ? (
        <XStack
          gap={8}
          alignItems="center"
          paddingHorizontal={12}
          paddingVertical={8}
          borderRadius={8}
          borderWidth={1}
          borderColor={communityUi.border}
          backgroundColor={communityUi.cardBg}
        >
          <Icons.Search size={18} color={communityUi.textMuted} />
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            borderWidth={0}
            backgroundColor="transparent"
            paddingHorizontal={0}
          />
        </XStack>
      ) : null}

      {filtered.length === 0 ? (
        <YStack padding="$6" alignItems="center">
          <Text color={communityUi.textMuted} textAlign="center">
            {emptyMessage}
          </Text>
        </YStack>
      ) : (
        <YStack gap={0}>
          {filtered.map((member) => (
            <UserListItem
              key={member.user_id}
              member={member}
              showConnect={showConnect}
              showFollow={showFollow}
            />
          ))}
        </YStack>
      )}

      {hasMore && onLoadMore ? (
        <XStack justifyContent="center" paddingVertical="$3">
          {isLoadingMore ? (
            <Spinner size="small" color={communityUi.brand} />
          ) : (
            <Text
              fontSize={14}
              fontWeight="600"
              color={communityUi.brand}
              cursor="pointer"
              onPress={onLoadMore}
            >
              Load more
            </Text>
          )}
        </XStack>
      ) : null}
    </YStack>
  )
}