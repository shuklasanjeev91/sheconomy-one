import { Link, useRouter } from 'one'
import { useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { fetchGroups, fetchMyGroups, type Group } from '~/community/lib/groups'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { radius } from '~/config/tokens'
import { useSupabase } from '~/providers/SupabaseProvider'

export function GroupsScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { user } = useSupabase()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState<Group[]>([])
  const [discover, setDiscover] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const [myGroups, pages] = await Promise.all([
        user ? fetchMyGroups(user.id) : Promise.resolve([]),
        fetchGroups(0, search),
      ])
      setMine(myGroups)
      setDiscover(pages.items)
      setIsLoading(false)
    }
    load()
  }, [search, user])

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
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <>
          {mine.length > 0 ? <GroupSection title="Your groups" items={mine} /> : null}
          <GroupSection title="Discover" items={discover} />
        </>
      )}
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
        <Link key={group.id} href={communityRoutes.group(group.id)}>
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
        </Link>
      ))}
    </CommunityCard>
  )
}