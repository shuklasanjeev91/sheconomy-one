import { useParams } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AboutDetailRow } from '~/community/components/AboutDetailRow'
import { CompanyFollowButton } from '~/community/components/CompanyFollowButton'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { EntityAdminRoster, type EntityAdminRosterPerson } from '~/community/components/EntityAdminRoster'
import { EntityPageHero } from '~/community/components/EntityPageHero'
import { EntityPageTabs } from '~/community/components/EntityPageTabs'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { ProfileLink } from '~/community/components/ProfileLink'
import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { fetchCompanyPostsPage } from '~/community/lib/community'
import {
  fetchCompanyBySlug,
  fetchCompanyFollowerCount,
  fetchCompanyFollowers,
  fetchCompanyMembers,
  fetchCompanyMembership,
  setCompanyMemberRole,
  updateCompanyPage,
  type CompanyPage,
} from '~/community/lib/companies'
import { searchJobsByCompany, type JobListing } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { CommunityPost } from '~/community/lib/community'
import {
  Avatar,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ShareButton } from '~/components/share'
import { LocationPickerField } from '~/components/geo'
import { communityRoutes } from '~/lib/routes'
import { getCompanyShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'
import { usePageSeo } from '~/components/seo/RouteSeo'

import { BRAND_MEMBER_LABEL } from '~/config/brand'

const BASE_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'followers', label: 'Followers' },
] as const

type Tab = (typeof BASE_TABS)[number]['id'] | 'admins'

export function CompanyPageScreen() {
  const communityUi = useCommunityUi()
  const { slug } = useParams<{ slug: string }>()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [company, setCompany] = useState<CompanyPage | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [followers, setFollowers] = useState(0)
  const [followerRows, setFollowerRows] = useState<Awaited<ReturnType<typeof fetchCompanyFollowers>>>([])
  const [adminPeople, setAdminPeople] = useState<EntityAdminRosterPerson[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [busyRoleUserId, setBusyRoleUserId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [editTagline, setEditTagline] = useState('')
  const [editIndustry, setEditIndustry] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editHeadquarters, setEditHeadquarters] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editSize, setEditSize] = useState('')

  const tabs = useMemo(() => {
    if (isManager) return [...BASE_TABS, { id: 'admins' as const, label: 'Admins' }]
    return [...BASE_TABS]
  }, [isManager])

  usePageSeo(
    useMemo(() => {
      if (!company) return null
      return {
        title: company.name,
        description:
          company.tagline?.trim() ||
          `${company.name} — ${company.industry} company on SHEconomy.`,
        image: company.logo_url ?? company.cover_url,
      }
    }, [company]),
  )

  const reload = useCallback(async () => {
    if (!slug) return
    setIsLoading(true)
    const { data } = await fetchCompanyBySlug(slug)
    setCompany(data)
    if (data) {
      const [count, jobResult, postResult, followerList, membership, members] = await Promise.all([
        fetchCompanyFollowerCount(data.id),
        searchJobsByCompany(data.name),
        fetchCompanyPostsPage(data.id, 0),
        fetchCompanyFollowers(data.id),
        user
          ? fetchCompanyMembership(data.id, user.id)
          : Promise.resolve({ role: null, isManager: false, isOwner: false }),
        user ? fetchCompanyMembers(data.id) : Promise.resolve([]),
      ])
      setFollowers(count)
      setFollowerRows(followerList)
      setJobs(jobResult.items)
      setPosts(postResult.items)
      setHasMore(postResult.hasMore)
      setPage(0)
      setIsOwner(membership.isOwner)
      setIsManager(membership.isManager)
      setAdminPeople(
        members.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          username: member.username,
          full_name: member.full_name,
          headline: member.headline,
          avatar_url: member.avatar_url,
        })),
      )
      setEditTagline(data.tagline ?? '')
      setEditIndustry(data.industry)
      setEditLocation(data.location ?? '')
      setEditHeadquarters(data.headquarters ?? '')
      setEditWebsite(data.website ?? '')
      setEditSize(data.size)
    } else {
      setIsOwner(false)
      setIsManager(false)
      setAdminPeople([])
    }
    setIsLoading(false)
  }, [slug, user])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = useCallback(async () => {
    if (!company || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const next = page + 1
    const result = await fetchCompanyPostsPage(company.id, next)
    setPosts((current) => [...current, ...result.items])
    setPage(next)
    setHasMore(result.hasMore)
    setIsLoadingMore(false)
  }, [company, hasMore, isLoadingMore, page])

  const meta = useMemo(() => {
    if (!company) return ''
    const parts = [company.industry, company.location, `${followers} followers`].filter(Boolean)
    return parts.join(' · ')
  }, [company, followers])

  async function handleSaveAbout() {
    if (!company || !user) return
    setIsSaving(true)
    const { error } = await updateCompanyPage(company.id, user.id, {
      tagline: editTagline,
      industry: editIndustry,
      location: editLocation,
      headquarters: editHeadquarters,
      website: editWebsite,
      size: editSize,
    })
    setIsSaving(false)
    if (error) {
      toast.show('Could not save', { tone: 'danger', message: error })
      return
    }
    toast.show('Page updated', { tone: 'success' })
    setIsEditing(false)
    reload()
  }

  async function handleToggleCompanyAdmin(person: EntityAdminRosterPerson) {
    if (!company || !isOwner) return
    const nextRole = person.role === 'admin' ? 'member' : 'admin'
    setBusyRoleUserId(person.user_id)
    if (nextRole === 'member') {
      setAdminPeople((prev) => prev.filter((row) => row.user_id !== person.user_id))
    } else {
      setAdminPeople((prev) => {
        if (prev.some((row) => row.user_id === person.user_id)) {
          return prev.map((row) => (row.user_id === person.user_id ? { ...row, role: 'admin' } : row))
        }
        return [...prev, { ...person, role: 'admin' }]
      })
    }
    const { error } = await setCompanyMemberRole(company.id, person.user_id, nextRole)
    setBusyRoleUserId(null)
    if (error) {
      toast.show('Could not change role', { tone: 'danger', message: error })
      reload()
      return
    }
    toast.show(nextRole === 'admin' ? 'Admin assigned' : 'Admin removed', { tone: 'success' })
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

  if (!company) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24}>
          <Text color={communityUi.textMuted}>Page not found.</Text>
        </CommunityCard>
      </CommunityShell>
    )
  }

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        <EntityPageHero
          coverUrl={company.cover_url}
          avatarUrl={company.logo_url}
          avatarName={company.name}
          title={company.name}
          subtitle={company.tagline}
          meta={meta}
          badge={`${company.size} · ${company.type}`}
          actions={
            <>
              <CompanyFollowButton company={company} />
              <ShareButton
                variant="outline"
                label="Share"
                sheetTitle="Share page"
                copyLabel="Copy page link"
                copyToastMessage="Page link copied to clipboard."
                payload={{
                  url: getCompanyShareUrl(company.id),
                  title: company.name,
                  text: company.tagline ?? undefined,
                }}
              />
              {isManager ? (
                <Button tone="outline" borderRadius={999} onPress={() => setIsEditing((value) => !value)}>
                  {isEditing ? 'Cancel edit' : 'Edit page'}
                </Button>
              ) : null}
              {isManager ? (
                <AppLink href={`${communityRoutes.createPost}?companyId=${company.id}` as never}>
                  <Button backgroundColor={communityUi.brand} color="white" borderRadius={999}>
                    Create post
                  </Button>
                </AppLink>
              ) : null}
            </>
          }
        />

        <EntityPageTabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

        {tab === 'home' ? (
          <YStack gap={12}>
            {isManager ? (
              <CommunityCard padding={16} gap={8}>
                <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                  Share an update as {company.name}
                </Text>
                <Text fontSize={13} color={communityUi.textMuted}>
                  Post news, hiring updates, or announcements to your followers.
                </Text>
                <AppLink href={`${communityRoutes.createPost}?companyId=${company.id}` as never}>
                  <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
                    Write a page post
                  </Text>
                </AppLink>
              </CommunityCard>
            ) : null}
            {posts.length === 0 ? (
              <CommunityCard padding={24}>
                <Text color={communityUi.textMuted}>No posts yet.</Text>
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
            {isEditing && isManager ? (
              <YStack gap={12}>
                <Field label="Tagline" value={editTagline} onChange={setEditTagline} />
                <Field label="Industry" value={editIndustry} onChange={setEditIndustry} />
                <Field label="Company size" value={editSize} onChange={setEditSize} />
                <LocationPickerField value={editLocation} onChange={setEditLocation} label="Location" />
                <Field label="Headquarters" value={editHeadquarters} onChange={setEditHeadquarters} />
                <Field label="Website" value={editWebsite} onChange={setEditWebsite} />
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
              <YStack gap={4}>
                <AboutDetailRow icon={Icons.Building2} label="Industry" value={company.industry} />
                <AboutDetailRow icon={Icons.Users} label="Company size" value={company.size} />
                {company.location ? <AboutDetailRow icon={Icons.MapPin} label="Location" value={company.location} /> : null}
                {company.headquarters ? (
                  <AboutDetailRow icon={Icons.Building2} label="Headquarters" value={company.headquarters} />
                ) : null}
                {company.founded_year ? (
                  <AboutDetailRow icon={Icons.Calendar} label="Founded" value={String(company.founded_year)} />
                ) : null}
                {company.website ? (
                  <AboutDetailRow icon={Icons.Link} label="Website" value={company.website} />
                ) : null}
                <Text fontSize={15} lineHeight={22} color={communityUi.text} paddingTop={8}>
                  {company.tagline || 'No overview added yet.'}
                </Text>
              </YStack>
            )}
          </CommunityCard>
        ) : null}

        {tab === 'jobs' ? (
          <CommunityCard padding={12} gap={0}>
            {jobs.length === 0 ? (
              <Text color={communityUi.textMuted} padding={12}>
                No open roles listed.
              </Text>
            ) : (
              jobs.map((job) => (
                <AppLink key={job.id} href={communityRoutes.job(job.id)}>
                  <YStack paddingVertical={14} paddingHorizontal={8} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} gap={4}>
                    <Text fontWeight="600" fontSize={16} color={communityUi.text}>
                      {job.title}
                    </Text>
                    <Text fontSize={13} color={communityUi.textMuted}>
                      {job.location} · {job.job_type} · {job.experience_level}
                    </Text>
                  </YStack>
                </AppLink>
              ))
            )}
          </CommunityCard>
        ) : null}

        {tab === 'followers' ? (
          <CommunityCard padding={12} gap={8}>
            {followerRows.length === 0 ? (
              <Text color={communityUi.textMuted} padding={8}>
                No followers yet.
              </Text>
            ) : (
              followerRows.map((follower) => {
                const alreadyAdmin = adminPeople.some((admin) => admin.user_id === follower.user_id)
                return (
                  <XStack
                    key={follower.user_id}
                    gap={12}
                    alignItems="center"
                    paddingVertical={8}
                    paddingHorizontal={8}
                    borderRadius={8}
                    hoverStyle={{ backgroundColor: communityUi.divider }}
                  >
                    <ProfileLink userId={follower.user_id} username={follower.username}>
                      <Avatar name={follower.full_name} src={follower.avatar_url ?? undefined} size="$4" />
                    </ProfileLink>
                    <YStack flex={1} gap={2} minWidth={0}>
                      <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                        {follower.full_name}
                      </Text>
                      <Text fontSize={13} color={communityUi.textMuted} numberOfLines={1}>
                        {follower.headline || BRAND_MEMBER_LABEL}
                      </Text>
                    </YStack>
                    {isOwner && !alreadyAdmin && follower.user_id !== user?.id ? (
                      <Button
                        tone="outline"
                        borderRadius={999}
                        size="$2"
                        disabled={busyRoleUserId === follower.user_id}
                        onPress={() =>
                          void handleToggleCompanyAdmin({
                            user_id: follower.user_id,
                            role: 'member',
                            username: follower.username,
                            full_name: follower.full_name,
                            headline: follower.headline,
                            avatar_url: follower.avatar_url,
                          })
                        }
                      >
                        Make admin
                      </Button>
                    ) : null}
                  </XStack>
                )
              })
            )}
          </CommunityCard>
        ) : null}

        {tab === 'admins' && isManager ? (
          <CommunityCard padding={16}>
            <EntityAdminRoster
              title="Page admins"
              subtitle={
                isOwner
                  ? 'Owners can assign or remove admins. Admins can edit the page and post as the company.'
                  : 'You can edit this page and post as the company.'
              }
              people={adminPeople}
              currentUserId={user?.id}
              canManageRoles={isOwner}
              lockedRoles={['owner']}
              busyUserId={busyRoleUserId}
              emptyMessage="No admins yet."
              onToggleAdmin={(person) => void handleToggleCompanyAdmin(person)}
            />
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