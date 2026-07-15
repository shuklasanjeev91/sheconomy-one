import { Link, useRouter } from 'one'
import { useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  CommunityFilterPill,
  CommunityFilterSheet,
  type FilterOption,
} from '~/community/components/CommunityFilters'
import { UserList } from '~/community/components/UserList'
import { useUserList } from '~/community/hooks/useUserList'
import { fetchPublicProfile } from '~/community/lib/network'
import {
  USER_LIST_META,
  type UserListKind,
} from '~/community/lib/user-lists'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useSupabase } from '~/providers/SupabaseProvider'

const SORT_OPTIONS: FilterOption[] = [
  { label: 'Recommended', value: 'default' },
  { label: 'Most mutual connections', value: 'mutual' },
  { label: 'Name (A–Z)', value: 'name' },
]

type PeopleActiveSheet = 'industry' | 'location' | 'sort' | null

function toOptions(values: (string | null | undefined)[]): FilterOption[] {
  const unique = Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0)))
  unique.sort((a, b) => a.localeCompare(b))
  return unique.map((value) => ({ label: value, value }))
}

function labelForValue(options: FilterOption[], value: string): string | undefined {
  return options.find((option) => option.value === value)?.label
}

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
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('default')
  const [activeSheet, setActiveSheet] = useState<PeopleActiveSheet>(null)

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

  const industryOptions = useMemo(() => toOptions(list.items.map((m) => m.industry)), [list.items])
  const locationOptions = useMemo(() => toOptions(list.items.map((m) => m.location)), [list.items])

  const visibleItems = useMemo(() => {
    let next = list.items.filter((member) => {
      if (industry && member.industry !== industry) return false
      if (location && member.location !== location) return false
      return true
    })

    if (sort === 'mutual') {
      next = [...next].sort((a, b) => (b.mutual_count ?? 0) - (a.mutual_count ?? 0))
    } else if (sort === 'name') {
      next = [...next].sort((a, b) => a.full_name.localeCompare(b.full_name))
    }

    return next
  }, [industry, list.items, location, sort])

  const activeFilterCount = (industry ? 1 : 0) + (location ? 1 : 0) + (sort !== 'default' ? 1 : 0)

  function clearFilters() {
    setIndustry('')
    setLocation('')
    setSort('default')
  }

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} alignItems="center" paddingVertical={2}>
            <CommunityFilterPill
              label="Industry"
              summary={industry || undefined}
              active={!!industry}
              onPress={() => setActiveSheet('industry')}
            />
            <CommunityFilterPill
              label="Location"
              summary={location || undefined}
              active={!!location}
              onPress={() => setActiveSheet('location')}
            />
            <CommunityFilterPill
              label="Sort by"
              summary={sort !== 'default' ? labelForValue(SORT_OPTIONS, sort) : undefined}
              active={sort !== 'default'}
              onPress={() => setActiveSheet('sort')}
            />
            {activeFilterCount > 0 ? (
              <Text
                fontSize={13}
                fontWeight="600"
                color={communityUi.brand}
                cursor="pointer"
                paddingHorizontal={6}
                onPress={clearFilters}
              >
                Clear all
              </Text>
            ) : null}
          </XStack>
        </ScrollView>
      </CommunityCard>

      <CommunityCard padding={12}>
        <UserList
          items={visibleItems}
          isLoading={list.isLoading}
          isLoadingMore={list.isLoadingMore}
          hasMore={list.hasMore}
          emptyMessage={meta.empty}
          onLoadMore={list.loadMore}
          showConnect={isOwnList || tab !== 'followers'}
          showFollow
        />
      </CommunityCard>

      <CommunityFilterSheet
        open={activeSheet === 'industry'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Industry"
        options={industryOptions}
        value={industry ? [industry] : []}
        onApply={(next) => setIndustry(next[0] ?? '')}
        searchable
        searchPlaceholder="Search industries"
      />
      <CommunityFilterSheet
        open={activeSheet === 'location'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Location"
        options={locationOptions}
        value={location ? [location] : []}
        onApply={(next) => setLocation(next[0] ?? '')}
        searchable
        searchPlaceholder="Search locations"
      />
      <CommunityFilterSheet
        open={activeSheet === 'sort'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Sort by"
        options={SORT_OPTIONS}
        value={[sort]}
        onApply={(next) => setSort(next[0] ?? 'default')}
      />
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