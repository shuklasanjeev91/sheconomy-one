import { useMemo, useState } from 'react'

import { UserListItem } from '~/community/components/UserListItem'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { UserListMember } from '~/community/lib/user-lists'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { ScreenSearchField } from '~/components/search'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'
import { Spinner, Text, XStack, YStack } from '~/components/ui'

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

  // Hide the search bar for short lists — it only earns its space on long ones.
  const showSearch = searchable && (items.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0)

  const filtered = useMemo(
    () =>
      filterBySearchQuery(items, query, (member) => [
        member.full_name,
        member.username,
        member.headline,
      ]),
    [items, query],
  )

  if (isLoading) {
    return (
      <YStack alignItems="center" paddingVertical="$8">
        <Spinner size="large" color={communityUi.brand} />
      </YStack>
    )
  }

  return (
    <YStack gap="$3" width="100%">
      {showSearch ? (
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          unifiedScope="people"
        />
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

      {onLoadMore ? (
        <>
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
          {!hasMore && filtered.length > 0 ? <LoadMoreEnd /> : null}
        </>
      ) : null}
    </YStack>
  )
}