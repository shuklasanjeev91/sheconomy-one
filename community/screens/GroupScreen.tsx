import { Link, useParams } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AboutDetailRow } from '~/community/components/AboutDetailRow'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { EntityPageHero } from '~/community/components/EntityPageHero'
import { EntityPageTabs } from '~/community/components/EntityPageTabs'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { ProfileLink } from '~/community/components/ProfileLink'
import { UserList } from '~/community/components/UserList'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { fetchGroupPostsPage } from '~/community/lib/community'
import type { CommunityPost } from '~/community/lib/community'
import {
  fetchEventsByOrganizers,
  type CommunityEvent,
} from '~/community/lib/events'
import {
  fetchGroup,
  fetchGroupAdminUserIds,
  fetchGroupJoinRequests,
  fetchGroupMembers,
  fetchGroupMembership,
  joinGroup,
  leaveGroup,
  respondToGroupJoinRequest,
  updateGroup,
  type Group,
  type GroupJoinRequest,
} from '~/community/lib/groups'
import type { UserListMember } from '~/community/lib/user-lists'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Avatar,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ShareButton } from '~/components/share'
import { LocationPickerField } from '~/components/geo'
import { communityRoutes } from '~/lib/routes'
import { getGroupShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'

const TABS = [
  { id: 'discussion', label: 'Discussion' },
  { id: 'about', label: 'About' },
  { id: 'members', label: 'Members' },
  { id: 'events', label: 'Events' },
] as const

type Tab = (typeof TABS)[number]['id']

export function GroupScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [group, setGroup] = useState<Group | null>(null)
  const [tab, setTab] = useState<Tab>('discussion')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [members, setMembers] = useState<UserListMember[]>([])
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequest[]>([])
  const [groupEvents, setGroupEvents] = useState<CommunityEvent[]>([])
  const [isMember, setIsMember] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRules, setEditRules] = useState('')
  const [editLocation, setEditLocation] = useState('')

  const isAdmin = memberRole === 'admin'

  const reload = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    const { data } = await fetchGroup(id)
    setGroup(data)
    if (data) {
      const [postResult, memberRows, membership, adminIds] = await Promise.all([
        fetchGroupPostsPage(data.id, 0),
        fetchGroupMembers(data.id),
        user ? fetchGroupMembership(data.id, user.id) : Promise.resolve({ isMember: false, isPending: false, role: null }),
        fetchGroupAdminUserIds(data.id),
      ])
      setPosts(postResult.items)
      setHasMore(postResult.hasMore)
      setPage(0)
      setMembers(
        memberRows.map((member) => ({
          user_id: member.user_id ?? '',
          username: member.profile?.username ?? '',
          full_name: member.profile?.full_name ?? member.profile?.username ?? 'Member',
          headline: member.profile?.headline ?? null,
          avatar_url: member.profile?.avatar_url ?? null,
          location: null,
          industry: null,
          is_verified: false,
          mutual_count: 0,
          connection_id: null,
          connection_status: null,
          is_sender: false,
        })),
      )
      setIsMember(membership.isMember)
      setIsPending(membership.isPending)
      setMemberRole(membership.role)
      setEditTitle(data.title)
      setEditDescription(data.description ?? '')
      setEditRules(data.rules ?? '')
      setEditLocation(data.location ?? '')

      if (membership.role === 'admin') {
        const requests = await fetchGroupJoinRequests(data.id)
        setJoinRequests(requests)
      } else {
        setJoinRequests([])
      }

      const events = await fetchEventsByOrganizers(adminIds)
      setGroupEvents(events)
    }
    setIsLoading(false)
  }, [id, user])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = useCallback(async () => {
    if (!group || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const next = page + 1
    const result = await fetchGroupPostsPage(group.id, next)
    setPosts((current) => [...current, ...result.items])
    setPage(next)
    setHasMore(result.hasMore)
    setIsLoadingMore(false)
  }, [group, hasMore, isLoadingMore, page])

  const meta = useMemo(() => {
    if (!group) return ''
    return `${group.members_count ?? members.length} members · ${group.group_type ?? 'public'}${group.location ? ` · ${group.location}` : ''}`
  }, [group, members.length])

  async function toggleMembership() {
    if (!user || !group) return
    setIsToggling(true)
    if (isMember) {
      const result = await leaveGroup(group.id, user.id)
      if (result.error) toast.show('Could not leave', { tone: 'danger', message: result.error })
      else {
        setIsMember(false)
        setMemberRole(null)
        toast.show('Left group', { tone: 'success' })
      }
    } else {
      const result = await joinGroup(group.id, user.id, group.group_type)
      if (result.error) toast.show('Could not join', { tone: 'danger', message: result.error })
      else if (result.pending) {
        setIsPending(true)
        toast.show('Request sent', { tone: 'success' })
      } else {
        setIsMember(true)
        setMemberRole('member')
        toast.show('Joined group', { tone: 'success' })
      }
    }
    setIsToggling(false)
    reload()
  }

  async function handleJoinRequest(requestId: string, approve: boolean) {
    if (!user || !group) return
    const result = await respondToGroupJoinRequest(requestId, group.id, user.id, approve)
    if (result.error) toast.show('Request failed', { tone: 'danger', message: result.error })
    else reload()
  }

  async function handleSaveAbout() {
    if (!group || !user) return
    setIsSaving(true)
    const { error } = await updateGroup(group.id, user.id, {
      title: editTitle,
      description: editDescription,
      rules: editRules,
      location: editLocation,
    })
    setIsSaving(false)
    if (error) toast.show('Could not save', { tone: 'danger', message: error })
    else {
      toast.show('Group updated', { tone: 'success' })
      setIsEditing(false)
      reload()
    }
  }

  if (isLoading) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!group) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24}>
          <Text color={communityUi.textMuted}>Group not found.</Text>
        </CommunityCard>
      </CommunityShell>
    )
  }

  const joinLabel = isMember ? 'Joined' : isPending ? 'Request pending' : group.group_type === 'private' ? 'Request to join' : 'Join group'

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        <EntityPageHero
          coverUrl={group.cover_url}
          avatarUrl={group.avatar_url}
          avatarName={group.title}
          title={group.title}
          subtitle={group.description}
          meta={meta}
          badge={group.group_type === 'private' ? 'Private group' : 'Public group'}
          actions={
            <>
              {user ? (
                <Button
                  backgroundColor={isMember ? communityUi.divider : communityUi.brand}
                  color={isMember ? communityUi.textMuted : 'white'}
                  borderRadius={999}
                  disabled={isToggling || isPending}
                  onPress={toggleMembership}
                >
                  {joinLabel}
                </Button>
              ) : null}
              <ShareButton
                variant="outline"
                label="Share"
                sheetTitle="Share group"
                copyLabel="Copy group link"
                copyToastMessage="Group link copied to clipboard."
                payload={{
                  url: getGroupShareUrl(group.id),
                  title: group.title,
                  text: group.description ?? undefined,
                }}
              />
              {isMember ? (
                <Link href={`${communityRoutes.createPost}?groupId=${group.id}` as never}>
                  <Button backgroundColor={communityUi.brand} color="white" borderRadius={999}>
                    Start a post
                  </Button>
                </Link>
              ) : null}
              {isAdmin ? (
                <Button tone="outline" borderRadius={999} onPress={() => setIsEditing((value) => !value)}>
                  {isEditing ? 'Cancel edit' : 'Manage group'}
                </Button>
              ) : null}
              <Link href={communityRoutes.eventCreate}>
                <Button tone="outline" borderRadius={999}>
                  Create event
                </Button>
              </Link>
            </>
          }
        />

        {isAdmin && joinRequests.length > 0 ? (
          <CommunityCard padding={16} gap={12}>
            <Text fontSize={16} fontWeight="700" color={communityUi.text}>
              Pending join requests
            </Text>
            {joinRequests.map((request) => (
              <XStack key={request.id} gap={12} alignItems="center" justifyContent="space-between">
                <ProfileLink userId={request.user_id} username={request.username}>
                  <XStack gap={10} alignItems="center">
                    <Avatar name={request.full_name} src={request.avatar_url ?? undefined} size="$3" />
                    <YStack>
                      <Text fontSize={14} fontWeight="600" color={communityUi.text}>
                        {request.full_name}
                      </Text>
                      <Text fontSize={12} color={communityUi.textMuted}>
                        {request.headline || 'Requested to join'}
                      </Text>
                    </YStack>
                  </XStack>
                </ProfileLink>
                <XStack gap={8}>
                  <Button size="$2" backgroundColor={communityUi.brand} color="white" onPress={() => handleJoinRequest(request.id, true)}>
                    Accept
                  </Button>
                  <Button size="$2" tone="outline" onPress={() => handleJoinRequest(request.id, false)}>
                    Decline
                  </Button>
                </XStack>
              </XStack>
            ))}
          </CommunityCard>
        ) : null}

        <EntityPageTabs tabs={[...TABS]} active={tab} onChange={(value) => setTab(value as Tab)} />

        {tab === 'discussion' ? (
          <YStack gap={12}>
            {isMember ? (
              <CommunityCard padding={16} gap={8}>
                <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                  Start a conversation
                </Text>
                <Link href={`${communityRoutes.createPost}?groupId=${group.id}` as never}>
                  <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
                    Write something to the group
                  </Text>
                </Link>
              </CommunityCard>
            ) : null}
            {posts.length === 0 ? (
              <CommunityCard padding={24}>
                <Text color={communityUi.textMuted}>No discussions yet. Be the first to post.</Text>
              </CommunityCard>
            ) : (
              posts.map((post) => <FeedPostCard key={post.id} post={post} />)
            )}
            <LoadMoreSentinel hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
            {!hasMore && posts.length > 0 ? <LoadMoreEnd /> : null}
          </YStack>
        ) : null}

        {tab === 'about' ? (
          <CommunityCard padding={16} gap={12}>
            {isEditing && isAdmin ? (
              <YStack gap={12}>
                <Field label="Group title" value={editTitle} onChange={setEditTitle} />
                <YStack gap={6}>
                  <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                    Description
                  </Text>
                  <TextArea value={editDescription} onChangeText={setEditDescription} minHeight={100} />
                </YStack>
                <YStack gap={6}>
                  <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                    Group rules
                  </Text>
                  <TextArea value={editRules} onChangeText={setEditRules} minHeight={80} />
                </YStack>
                <LocationPickerField value={editLocation} onChange={setEditLocation} label="Location" />
                <Button
                  backgroundColor={communityUi.brand}
                  color="white"
                  borderRadius={999}
                  disabled={isSaving}
                  onPress={handleSaveAbout}
                  icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
                >
                  Save changes
                </Button>
              </YStack>
            ) : (
              <YStack gap={8}>
                <Text fontSize={15} lineHeight={22} color={communityUi.text}>
                  {group.description || 'No description yet.'}
                </Text>
                {group.rules ? <AboutDetailRow icon={Icons.Shield} label="Group rules" value={group.rules} /> : null}
                {group.location ? <AboutDetailRow icon={Icons.MapPin} label="Location" value={group.location} /> : null}
                {group.industries?.length ? (
                  <AboutDetailRow icon={Icons.Briefcase} label="Industries" value={group.industries.join(', ')} />
                ) : null}
              </YStack>
            )}
          </CommunityCard>
        ) : null}

        {tab === 'members' ? (
          <CommunityCard padding={12}>
            <UserList items={members} showConnect showFollow searchable />
          </CommunityCard>
        ) : null}

        {tab === 'events' ? (
          <CommunityCard padding={12} gap={0}>
            <XStack padding={8} justifyContent="space-between" alignItems="center">
              <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                Upcoming group events
              </Text>
              <Link href={communityRoutes.eventCreate}>
                <Text fontSize={13} fontWeight="600" color={communityUi.brand}>
                  Create
                </Text>
              </Link>
            </XStack>
            {groupEvents.length === 0 ? (
              <Text color={communityUi.textMuted} padding={12}>
                No upcoming events from group organizers.
              </Text>
            ) : (
              groupEvents.map((event) => (
                <Link key={event.id} href={communityRoutes.event(event.id)}>
                  <YStack paddingVertical={12} paddingHorizontal={8} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} gap={4}>
                    <Text fontWeight="600" color={communityUi.text}>
                      {event.title}
                    </Text>
                    <Text fontSize={13} color={communityUi.textMuted}>
                      {formatWhen(event.start_time)}
                      {event.is_online ? ' · Online' : event.location ? ` · ${event.location}` : ''}
                    </Text>
                  </YStack>
                </Link>
              ))
            )}
          </CommunityCard>
        ) : null}
      </YStack>
    </CommunityShell>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const communityUi = useCommunityUi()
  return (
    <YStack gap={6}>
      <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
        {label}
      </Text>
      <Input value={value} onChangeText={onChange} />
    </YStack>
  )
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}