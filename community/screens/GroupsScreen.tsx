import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  CommunityFilterPill,
  CommunityFilterSheet,
  type FilterOption,
} from '~/community/components/CommunityFilters'
import { fetchGroupFacets, fetchGroups, fetchMyGroups, type Group } from '~/community/lib/groups'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Input, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { radius } from '~/config/tokens'
import { useSupabase } from '~/providers/SupabaseProvider'

const TYPE_OPTIONS: FilterOption[] = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
]

type ActiveSheet = 'type' | 'location' | 'industry' | null

function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ label: value, value }))
}

export function GroupsScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { user } = useSupabase()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState<Group[]>([])
  const [discover, setDiscover] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [groupType, setGroupType] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [facets, setFacets] = useState<{ locations: string[]; industries: string[] }>({
    locations: [],
    industries: [],
  })
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)

  useEffect(() => {
    fetchGroupFacets().then(setFacets)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const [myGroups, pages] = await Promise.all([
        user ? fetchMyGroups(user.id) : Promise.resolve([]),
        fetchGroups(0, search, { groupType, location, industry }),
      ])
      if (cancelled) return
      setMine(myGroups)
      setDiscover(pages.items)
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [groupType, industry, location, search, user])

  const locationOptions = useMemo(() => toOptions(facets.locations), [facets.locations])
  const industryOptions = useMemo(() => toOptions(facets.industries), [facets.industries])

  const filteredDiscover = discover

  const activeCount = (groupType ? 1 : 0) + (location ? 1 : 0) + (industry ? 1 : 0)

  function clearAll() {
    setGroupType('')
    setLocation('')
    setIndustry('')
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Groups"
          subtitle="Join communities and share with members."
          actions={
            user ? (
              <Button
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                onPress={() => router.push(communityRoutes.groupCreate)}
              >
                Create group
              </Button>
            ) : undefined
          }
        />
        <XStack gap={8} alignItems="center" padding={12} borderRadius={radius.chip} borderWidth={1} borderColor={communityUi.borderLight} backgroundColor={communityUi.inputBg}>
          <Icons.Search size={18} color={communityUi.textMuted} />
          <Input flex={1} value={search} onChangeText={setSearch} placeholder="Search groups" borderWidth={0} backgroundColor="transparent" />
        </XStack>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} alignItems="center" paddingVertical={2}>
            <CommunityFilterPill
              label="Group type"
              summary={groupType ? (groupType === 'public' ? 'Public' : 'Private') : undefined}
              active={!!groupType}
              onPress={() => setActiveSheet('type')}
            />
            <CommunityFilterPill
              label="Location"
              summary={location || undefined}
              active={!!location}
              onPress={() => setActiveSheet('location')}
            />
            <CommunityFilterPill
              label="Industry"
              summary={industry || undefined}
              active={!!industry}
              onPress={() => setActiveSheet('industry')}
            />
            {activeCount > 0 ? (
              <Text
                fontSize={13}
                fontWeight="600"
                color={communityUi.brand}
                cursor="pointer"
                paddingHorizontal={6}
                onPress={clearAll}
              >
                Clear all
              </Text>
            ) : null}
          </XStack>
        </ScrollView>
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <>
          {mine.length > 0 ? <GroupSection title="Your groups" items={mine} /> : null}
          <GroupSection title="Discover" items={filteredDiscover} />
        </>
      )}

      <CommunityFilterSheet
        open={activeSheet === 'type'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Group type"
        options={TYPE_OPTIONS}
        value={groupType ? [groupType] : []}
        onApply={(next) => setGroupType(next[0] ?? '')}
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
        open={activeSheet === 'industry'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Industry"
        options={industryOptions}
        value={industry ? [industry] : []}
        onApply={(next) => setIndustry(next[0] ?? '')}
        searchable
        searchPlaceholder="Search industries"
      />
    </CommunityShell>
  )
}

function GroupSection({ title, items }: { title: string; items: Group[] }) {
  const communityUi = useCommunityUi()
  if (!items.length) return null
  return (
    <CommunityCard padding={12} gap={0}>
      <Text fontSize={16} fontWeight="700" color={communityUi.text} paddingBottom={12}>
        {title}
      </Text>
      {items.map((group) => (
        <AppLink key={group.id} href={communityRoutes.group(group.id)}>
          <XStack gap={12} paddingVertical={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} alignItems="center">
            <Avatar name={group.title} src={group.avatar_url ?? undefined} size="$4" />
            <YStack flex={1} gap={2}>
              <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                {group.title}
              </Text>
              <Text fontSize={13} color={communityUi.textMuted}>
                {group.members_count ?? 0} members · {group.group_type ?? 'public'}
              </Text>
            </YStack>
          </XStack>
        </AppLink>
      ))}
    </CommunityCard>
  )
}