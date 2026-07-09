import { Link, useRouter } from 'one'
import { useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { UserList } from '~/community/components/UserList'
import { useUserList } from '~/community/hooks/useUserList'
import { fetchPublicProfile } from '~/community/lib/network'
import {
  USER_LIST_META,
  type UserListKind,
} from '~/community/lib/user-lists'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useSupabase } from '~/providers/SupabaseProvider'

const TABS: UserListKind[] = [
  'connections',
  'followers',
  'following',
  'pending-received',
  'suggestions',
]

type PeopleScreenProps = {
  initialTab?: UserListKind
  profileHandle?: string
}

function parseTab(value?: string): UserListKind {
  if (value && value in USER_LIST_META) {
    return value as UserListKind
  }
  return 'connections'
}

export function PeopleScreen({ initialTab, profileHandle }: PeopleScreenProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { user, isLoading: authLoading } = useSupabase()
  const { profile: ownProfile } = useProfile()
  const [tab, setTab] = useState<UserListKind>(parseTab(initialTab))
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [subjectName, setSubjectName] = useState('You')
  const [isResolving, setIsResolving] = useState(!!profileHandle)

  const isOwnList = !profileHandle

  useEffect(() => {
    if (profileHandle) {
      setIsResolving(true)
      fetchPublicProfile(profileHandle).then(({ data }) => {
        setSubjectId(data?.id ?? null)
        setSubjectName(data?.full_name || data?.username || 'Member')
        setIsResolving(false)
      })
      return
    }

    setSubjectId(ownProfile?.id ?? user?.id ?? null)
    setSubjectName(ownProfile?.full_name || ownProfile?.username || 'You')
    setIsResolving(false)
  }, [ownProfile?.full_name, ownProfile?.id, ownProfile?.username, profileHandle, user?.id])

  useEffect(() => {
    setTab(parseTab(initialTab))
  }, [initialTab])

  const listUserId = subjectId ?? undefined
  const list = useUserList(tab, listUserId, !!listUserId)

  const meta = USER_LIST_META[tab]
  const visibleTabs = useMemo(() => {
    if (!isOwnList) {
      return ['followers', 'following', 'connections'] as UserListKind[]
    }
    return TABS
  }, [isOwnList])

  if (authLoading || isResolving) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!user && isOwnList) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24} gap={16}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Sign in to view your network
          </Text>
          <Link href={routes.signIn} asChild>
            <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
              Sign in
            </Text>
          </Link>
        </CommunityCard>
      </CommunityShell>
    )
  }

  if (!listUserId) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24}>
          <Text color={communityUi.textMuted}>Profile not found.</Text>
        </CommunityCard>
      </CommunityShell>
    )
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={12}>
        <YStack gap={4}>
          <Text fontSize={22} fontWeight="700" color={communityUi.text}>
            {isOwnList ? meta.title : `${subjectName} · ${meta.title}`}
          </Text>
          <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
            {meta.description}
          </Text>
        </YStack>

        <XStack gap={8} flexWrap="wrap">
          {visibleTabs.map((kind) => (
            <TabChip
              key={kind}
              label={USER_LIST_META[kind].title}
              active={tab === kind}
              onPress={() => {
                setTab(kind)
                if (isOwnList) {
                  router.replace(communityRoutes.peopleTab(kind) as never)
                }
              }}
            />
          ))}
        </XStack>
      </CommunityCard>

      <CommunityCard padding={12}>
        <UserList
          items={list.items}
          isLoading={list.isLoading}
          isLoadingMore={list.isLoadingMore}
          hasMore={list.hasMore}
          emptyMessage={meta.empty}
          onLoadMore={list.loadMore}
          showConnect={isOwnList || tab !== 'followers'}
          showFollow
        />
      </CommunityCard>
    </CommunityShell>
  )
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={14}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? 'rgba(10,102,194,0.08)' : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Text
        fontSize={13}
        fontWeight={active ? '700' : '600'}
        color={active ? communityUi.brand : communityUi.textMuted}
      >
        {label}
      </Text>
    </XStack>
  )
}