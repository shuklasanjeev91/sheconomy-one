import { useUserList } from '~/community/hooks/useUserList'
import { UserList } from '~/community/components/UserList'
import { USER_LIST_META, type UserListKind } from '~/community/lib/user-lists'
import { AppBottomSheet, Text, YStack } from '~/components/ui'
import { useCommunityUi } from '~/community/lib/community-theme'

type UserListBottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: UserListKind | null
  userId: string
  isOwnProfile?: boolean
  subjectName?: string
  /** Profile counter — sheet uses live total so they stay aligned. */
  expectedCount?: number | null
}

export function UserListBottomSheet({
  open,
  onOpenChange,
  kind,
  userId,
  isOwnProfile = false,
  subjectName,
}: UserListBottomSheetProps) {
  const communityUi = useCommunityUi()
  const list = useUserList(kind ?? 'connections', userId, open && !!kind)

  if (!kind) return null

  const meta = USER_LIST_META[kind]
  const liveCount = list.isLoading ? null : list.totalCount
  const countLabel = liveCount == null ? '' : ` (${liveCount})`
  const title = isOwnProfile
    ? `${meta.title}${countLabel}`
    : `${subjectName ?? 'Member'} · ${meta.title}${countLabel}`

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title} scrollable>
      <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4">
        <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
          {meta.description}
        </Text>
        {list.error ? (
          <Text fontSize={13} color={communityUi.danger ?? '#b91c1c'}>
            {list.error}
          </Text>
        ) : null}
        <UserList
          items={list.items}
          isLoading={list.isLoading}
          isLoadingMore={list.isLoadingMore}
          hasMore={list.hasMore}
          emptyMessage={meta.empty}
          onLoadMore={list.loadMore}
          showConnect={isOwnProfile || kind !== 'followers'}
          showFollow
          searchable
        />
      </YStack>
    </AppBottomSheet>
  )
}
