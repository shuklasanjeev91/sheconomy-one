/**
 * Community Groups service — typed Supabase data-access layer for admin (+ reusable).
 *
 * UI should dispatch store thunks rather than calling these directly.
 * Authorisation is enforced by Supabase RLS; admin clients typically have role 'A'.
 */

import { isUuid } from '~/commerce/lib/seo-urls'
import { supabase, type Json } from '~/lib/supabase'
import { getStoragePublicUrl, uploadStorageObject } from '~/lib/supabase/storage-upload'
import { blockedImageMessage } from '~/lib/safety/content-screen'

import { toFriendlyGroupError } from '~/lib/group/group.errors'
import {
  DEFAULT_GROUP_LIMIT,
  DEFAULT_GROUP_TYPE,
  GROUP_IMAGE_MAX_BYTES,
  GROUP_MEDIA_BUCKET,
  GROUP_TYPES,
  type CreateGroupInput,
  type Group,
  type GroupCreatorRef,
  type GroupDetail,
  type GroupEngagementStats,
  type GroupFacets,
  type GroupImageUploadFile,
  type GroupInvitationWithProfile,
  type GroupJoinRequestWithProfile,
  type GroupListParams,
  type GroupMemberRole,
  type GroupMemberWithProfile,
  type GroupPlatformStats,
  type GroupServiceResponse,
  type GroupUpdate,
  type GroupWithCounts,
  type UpdateGroupInput,
} from '~/lib/group/group.type'
import { emptyGroupEngagementStats, normalizeGroupName } from '~/lib/group/group.utils'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T, meta?: GroupServiceResponse<T>['meta']): GroupServiceResponse<T> {
  return { data, error: null, success: true, meta }
}

function fail<T>(error: unknown, fallback?: string): GroupServiceResponse<T> {
  return { data: null, error: toFriendlyGroupError(error, fallback), success: false }
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('User not authenticated')
  return data.user.id
}

// ============= COUNT / PROFILE HELPERS =============

async function fetchCreatorsByIds(userIds: string[]): Promise<Record<string, GroupCreatorRef>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (!unique.length) return {}

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, email, headline')
    .in('id', unique)

  const map: Record<string, GroupCreatorRef> = {}
  for (const row of data ?? []) {
    map[row.id] = row as GroupCreatorRef
  }
  return map
}

async function countMembersForGroupIds(groupIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of groupIds) counts[id] = 0
  if (!groupIds.length) return counts

  await Promise.all(
    groupIds.map(async (groupId) => {
      const { count } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'active')
      counts[groupId] = count ?? 0
    }),
  )
  return counts
}

async function countPostsForGroupIds(groupIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of groupIds) counts[id] = 0
  if (!groupIds.length) return counts

  await Promise.all(
    groupIds.map(async (groupId) => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('is_deleted', false)
      counts[groupId] = count ?? 0
    }),
  )
  return counts
}

async function countPendingRequestsForGroupIds(
  groupIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const id of groupIds) counts[id] = 0
  if (!groupIds.length) return counts

  await Promise.all(
    groupIds.map(async (groupId) => {
      const { count } = await supabase
        .from('group_join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'pending')
      counts[groupId] = count ?? 0
    }),
  )
  return counts
}

async function withCounts(groups: Group[]): Promise<GroupWithCounts[]> {
  if (!groups.length) return []
  const ids = groups.map((g) => g.id)
  const creatorIds = groups.map((g) => g.created_by).filter(Boolean) as string[]

  const [members, posts, pending, creators] = await Promise.all([
    countMembersForGroupIds(ids),
    countPostsForGroupIds(ids),
    countPendingRequestsForGroupIds(ids),
    fetchCreatorsByIds(creatorIds),
  ])

  return groups.map((group) => ({
    ...group,
    member_count: members[group.id] ?? group.members_count ?? 0,
    post_count: posts[group.id] ?? 0,
    pending_request_count: pending[group.id] ?? 0,
    creator: group.created_by ? creators[group.created_by] ?? null : null,
  }))
}

// ============================================================================
// ADMIN — LIST / READ
// ============================================================================

/** Paginated admin list with optional filters + aggregate counts. */
export async function listGroups(
  params: GroupListParams = {},
): Promise<GroupServiceResponse<GroupWithCounts[]>> {
  try {
    const limit = params.limit ?? DEFAULT_GROUP_LIMIT
    const offset = params.offset ?? 0
    const filters = params.filters ?? {}
    const orderBy = params.orderBy ?? 'created_at'
    const ascending = params.ascending ?? false

    let query = supabase
      .from('groups')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1)

    if (filters.search?.trim()) {
      const q = filters.search.trim().replace(/[%]/g, '')
      query = query.or(
        `name.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`,
      )
    }
    if (filters.group_type) query = query.eq('group_type', filters.group_type)
    if (filters.created_by) query = query.eq('created_by', filters.created_by)
    if (filters.location?.trim()) {
      const value = filters.location.trim().replace(/[%,]/g, '')
      query = query.ilike('location', `%${value}%`)
    }
    if (filters.industry?.trim()) {
      query = query.contains('industries', [filters.industry.trim()])
    }

    const { data, error, count } = await query
    if (error) return fail(error)

    const enriched = await withCounts((data ?? []) as Group[])
    const total = count ?? 0

    return ok(enriched, {
      total,
      limit,
      offset,
      hasMore: offset + enriched.length < total,
    })
  } catch (error) {
    return fail(error)
  }
}

/** Single group by primary uuid (with counts + creator). */
export async function getGroupById(
  id: string,
): Promise<GroupServiceResponse<GroupWithCounts>> {
  try {
    const { data, error } = await supabase.from('groups').select('*').eq('id', id).single()
    if (error) return fail(error)
    const [enriched] = await withCounts([data as Group])
    return ok(enriched)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Resolve by uuid **or** legacy `raw_group_data.id` (indexed via
 * `idx_groups_raw_group_data_id`).
 */
export async function getGroupByRawIdOrUuid(
  rawIdOrUuid: string,
): Promise<GroupServiceResponse<GroupWithCounts>> {
  try {
    const normalized = decodeURIComponent(rawIdOrUuid).trim()
    if (!normalized) return fail({ code: 'PGRST116', message: 'Group not found' })

    if (isUuid(normalized)) {
      const byId = await getGroupById(normalized)
      if (byId.success && byId.data) return byId
    }

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .filter('raw_group_data->>id', 'eq', normalized)
      .maybeSingle()

    if (error) return fail(error)
    if (!data) return fail({ code: 'PGRST116', message: 'Group not found' })

    const [enriched] = await withCounts([data as Group])
    return ok(enriched)
  } catch (error) {
    return fail(error)
  }
}

/** Full admin detail payload (group + members + join requests + invitations + engagement). */
export async function getGroupDetail(id: string): Promise<GroupServiceResponse<GroupDetail>> {
  try {
    const groupRes = await getGroupById(id)
    if (!groupRes.success || !groupRes.data) return fail(groupRes.error ?? 'Not found')

    const [membersRes, requestsRes, invitationsRes, engagementRes] = await Promise.all([
      getGroupMembers(id),
      getGroupJoinRequests(id),
      getGroupInvitations(id),
      getGroupEngagementStats(id),
    ])

    return ok({
      ...groupRes.data,
      members: membersRes.data ?? [],
      join_requests: requestsRes.data ?? [],
      invitations: invitationsRes.data ?? [],
      engagement: engagementRes.data ?? emptyGroupEngagementStats(),
    })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// ADMIN — CREATE / UPDATE / DELETE
// ============================================================================

export async function createGroup(
  input: CreateGroupInput,
): Promise<GroupServiceResponse<Group>> {
  try {
    const userId = await requireUserId()
    const ownerId = input.created_by ?? userId

    const { data, error } = await supabase
      .from('groups')
      .insert({
        name: normalizeGroupName(input.name),
        title: input.title.trim(),
        description: input.description ?? null,
        avatar_url: input.avatar_url ?? null,
        cover_url: input.cover_url ?? null,
        members_count: input.members_count ?? 1,
        industries: input.industries ?? null,
        location: input.location ?? null,
        rules: input.rules ?? null,
        group_type: input.group_type?.trim() || DEFAULT_GROUP_TYPE,
        allow_invites: input.allow_invites ?? true,
        require_post_review: input.require_post_review ?? false,
        created_by: ownerId,
        raw_group_data: (input.raw_group_data as Json | null | undefined) ?? null,
      })
      .select()
      .single()

    if (error) return fail(error)

    // Creator becomes admin member (mirrors community/lib/groups.ts).
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: data.id,
      user_id: ownerId,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    if (memberError) {
      // Group exists; surface membership issue but still return the row.
      console.warn('[group] failed to add creator as admin member', memberError.message)
    }

    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupServiceResponse<Group>> {
  try {
    const patch: GroupUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) patch.name = normalizeGroupName(input.name)
    if (input.title !== undefined) patch.title = input.title.trim()
    if (input.description !== undefined) patch.description = input.description
    if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url
    if (input.cover_url !== undefined) patch.cover_url = input.cover_url
    if (input.members_count !== undefined) patch.members_count = input.members_count
    if (input.industries !== undefined) patch.industries = input.industries
    if (input.location !== undefined) patch.location = input.location
    if (input.rules !== undefined) patch.rules = input.rules
    if (input.group_type !== undefined) patch.group_type = input.group_type
    if (input.allow_invites !== undefined) patch.allow_invites = input.allow_invites
    if (input.require_post_review !== undefined) {
      patch.require_post_review = input.require_post_review
    }
    if (input.created_by !== undefined) patch.created_by = input.created_by
    if (input.raw_group_data !== undefined) {
      patch.raw_group_data = input.raw_group_data as Json | null
    }

    const { data, error } = await supabase
      .from('groups')
      .update(patch)
      .eq('id', groupId)
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/**
 * Delete a group. Related members / join requests / invitations should cascade
 * or be cleaned by DB FKs; avatar/cover cleanup is best-effort from the caller.
 */
export async function deleteGroup(
  groupId: string,
): Promise<GroupServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    if (error) return fail(error)
    return ok({ id: groupId })
  } catch (error) {
    return fail(error)
  }
}

/** Delete many groups by id (admin batch). */
export async function deleteGroups(
  groupIds: string[],
): Promise<GroupServiceResponse<{ deleted: number }>> {
  try {
    const unique = Array.from(new Set(groupIds.filter(Boolean)))
    if (!unique.length) return ok({ deleted: 0 })

    const { error, count } = await supabase
      .from('groups')
      .delete({ count: 'exact' })
      .in('id', unique)

    if (error) return fail(error)
    return ok({ deleted: count ?? unique.length })
  } catch (error) {
    return fail(error)
  }
}

/** Delete all groups created by a profile (admin cleanup). */
export async function deleteGroupsByCreator(
  creatorId: string,
): Promise<GroupServiceResponse<{ deleted: number }>> {
  try {
    const { error, count } = await supabase
      .from('groups')
      .delete({ count: 'exact' })
      .eq('created_by', creatorId)

    if (error) return fail(error)
    return ok({ deleted: count ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Reassign `created_by` and ensure the new owner is an admin member. */
export async function reassignGroupOwner(
  groupId: string,
  newOwnerId: string,
): Promise<GroupServiceResponse<Group>> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .update({ created_by: newOwnerId, updated_at: new Date().toISOString() })
      .eq('id', groupId)
      .select()
      .single()

    if (error) return fail(error)

    const { data: existing } = await supabase
      .from('group_members')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', newOwnerId)
      .maybeSingle()

    if (existing) {
      if (existing.role !== 'admin' || existing.status !== 'active') {
        await supabase
          .from('group_members')
          .update({ role: 'admin', status: 'active' })
          .eq('id', existing.id)
      }
    } else {
      await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: newOwnerId,
        role: 'admin',
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      await supabase.rpc('increment_members_count', { group_id: groupId })
    }

    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// MEMBERS
// ============================================================================

export async function getGroupMembers(
  groupId: string,
): Promise<GroupServiceResponse<GroupMemberWithProfile[]>> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('id, group_id, user_id, role, status, joined_at')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('role', { ascending: true })

    if (error) return fail(error)

    const rows = (data ?? []).filter((r) => r.user_id && r.group_id)
    if (!rows.length) return ok([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, headline, avatar_url')
      .in(
        'id',
        rows.map((r) => r.user_id!),
      )

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    return ok(
      rows.map((row) => {
        const profile = byId.get(row.user_id!)
        return {
          id: row.id,
          group_id: row.group_id!,
          user_id: row.user_id!,
          role: (row.role as GroupMemberRole) ?? 'member',
          status: row.status ?? 'active',
          joined_at: row.joined_at,
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
          headline: profile?.headline ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }
      }),
    )
  } catch (error) {
    return fail(error)
  }
}

/** Promote / demote via SECURITY DEFINER RPC (`admin` | `member`). */
export async function setGroupMemberRole(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<GroupServiceResponse<{ group_id: string; user_id: string; role: string }>> {
  try {
    const { error } = await supabase.rpc('set_community_group_member_role', {
      p_group_id: groupId,
      p_user_id: userId,
      p_role: role,
    })
    if (error) return fail(error)
    return ok({ group_id: groupId, user_id: userId, role })
  } catch (error) {
    return fail(error)
  }
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<GroupServiceResponse<{ removed: boolean }>> {
  try {
    const { data: group } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', groupId)
      .maybeSingle()

    if (group?.created_by && group.created_by === userId) {
      return fail('Cannot remove the group creator. Reassign ownership first.')
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)

    if (error) return fail(error)

    await supabase.rpc('decrement_members_count', { group_id: groupId })
    return ok({ removed: true })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// JOIN REQUESTS
// ============================================================================

export async function getGroupJoinRequests(
  groupId: string,
  status: string = 'pending',
): Promise<GroupServiceResponse<GroupJoinRequestWithProfile[]>> {
  try {
    let query = supabase
      .from('group_join_requests')
      .select('id, group_id, user_id, status, requested_at')
      .eq('group_id', groupId)
      .order('requested_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return fail(error)

    const rows = (data ?? []).filter((r) => r.user_id && r.group_id)
    if (!rows.length) return ok([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, headline, avatar_url')
      .in(
        'id',
        rows.map((r) => r.user_id!),
      )

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    return ok(
      rows.map((row) => {
        const profile = byId.get(row.user_id!)
        return {
          id: row.id,
          group_id: row.group_id!,
          user_id: row.user_id!,
          status: row.status ?? 'pending',
          requested_at: row.requested_at,
          username: profile?.username ?? null,
          full_name: profile?.full_name ?? null,
          headline: profile?.headline ?? null,
          avatar_url: profile?.avatar_url ?? null,
        }
      }),
    )
  } catch (error) {
    return fail(error)
  }
}

/**
 * Approve or reject a join request (admin bypasses group-admin membership check).
 * On approve, inserts an active member and increments `members_count`.
 */
export async function respondToGroupJoinRequest(
  requestId: string,
  groupId: string,
  approve: boolean,
): Promise<GroupServiceResponse<{ status: string; user_id: string }>> {
  try {
    const { data: request, error: fetchError } = await supabase
      .from('group_join_requests')
      .select('user_id, group_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (fetchError) return fail(fetchError)
    if (!request?.user_id || request.group_id !== groupId) {
      return fail({ code: 'PGRST116', message: 'Join request not found' })
    }

    const status = approve ? 'approved' : 'rejected'
    const { error: updateError } = await supabase
      .from('group_join_requests')
      .update({ status })
      .eq('id', requestId)

    if (updateError) return fail(updateError)

    if (approve) {
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', request.user_id)
        .maybeSingle()

      if (!existing) {
        const { error: memberError } = await supabase.from('group_members').insert({
          group_id: groupId,
          user_id: request.user_id,
          role: 'member',
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        if (memberError) return fail(memberError)
        await supabase.rpc('increment_members_count', { group_id: groupId })
      }
    }

    return ok({ status, user_id: request.user_id })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// INVITATIONS
// ============================================================================

export async function getGroupInvitations(
  groupId: string,
  limit = 50,
): Promise<GroupServiceResponse<GroupInvitationWithProfile[]>> {
  try {
    const { data, error } = await supabase
      .from('group_invitations')
      .select(
        'id, group_id, invited_by, invited_user_id, message, status, created_at, responded_at',
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return fail(error)
    const rows = data ?? []
    if (!rows.length) return ok([])

    const inviteeIds = rows.map((r) => r.invited_user_id).filter(Boolean) as string[]
    const { data: profiles } = inviteeIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', inviteeIds)
      : { data: [] as { id: string; username: string | null; full_name: string | null; avatar_url: string | null }[] }

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

    return ok(
      rows
        .filter((row) => row.group_id)
        .map((row) => {
          const profile = row.invited_user_id ? byId.get(row.invited_user_id) : null
          return {
            id: row.id,
            group_id: row.group_id!,
            invited_by: row.invited_by,
            invited_user_id: row.invited_user_id,
            message: row.message,
            status: row.status,
            created_at: row.created_at,
            responded_at: row.responded_at,
            invitee_username: profile?.username ?? null,
            invitee_full_name: profile?.full_name ?? null,
            invitee_avatar_url: profile?.avatar_url ?? null,
          }
        }),
    )
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// POSTS / ENGAGEMENT
// ============================================================================

export async function getGroupPostCount(
  groupId: string,
): Promise<GroupServiceResponse<number>> {
  try {
    const { count, error } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('is_deleted', false)
    if (error) return fail(error)
    return ok(count ?? 0)
  } catch (error) {
    return fail(error)
  }
}

async function getGroupPostIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .eq('group_id', groupId)
    .eq('is_deleted', false)
  if (error) throw error
  return (data ?? []).map((r) => r.id)
}

export async function getGroupEngagementStats(
  groupId: string,
): Promise<GroupServiceResponse<GroupEngagementStats>> {
  try {
    const ids = await getGroupPostIds(groupId)
    if (!ids.length) return ok(emptyGroupEngagementStats())

    const { data, error } = await supabase
      .from('posts_with_stats')
      .select(
        'total_reactions, total_comments, total_views, like_count, love_count, celebrate_count, support_count, insightful_count, funny_count',
      )
      .in('id', ids)

    if (error) return fail(error)

    const stats: GroupEngagementStats = emptyGroupEngagementStats()
    for (const post of data ?? []) {
      stats.total_reactions += Number(post.total_reactions ?? 0)
      stats.total_comments += Number(post.total_comments ?? 0)
      stats.total_views += Number(post.total_views ?? 0)
      stats.like_count += Number(post.like_count ?? 0)
      stats.love_count += Number(post.love_count ?? 0)
      stats.celebrate_count += Number(post.celebrate_count ?? 0)
      stats.support_count += Number(post.support_count ?? 0)
      stats.insightful_count += Number(post.insightful_count ?? 0)
      stats.funny_count += Number(post.funny_count ?? 0)
    }

    return ok(stats)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// FACETS + PLATFORM STATS
// ============================================================================

export async function getGroupFacets(): Promise<GroupServiceResponse<GroupFacets>> {
  try {
    const locations = new Set<string>()
    const industries = new Set<string>()
    const groupTypes = new Set<string>()
    const sorted = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b))

    const { data: facetRows, error } = await supabase.rpc('community_group_facets')
    if (!error && facetRows) {
      for (const row of facetRows as { facet: string; value: string }[]) {
        if (row.facet === 'location') locations.add(row.value)
        else if (row.facet === 'industry' || row.facet === 'industries') industries.add(row.value)
        else if (row.facet === 'group_type' || row.facet === 'type') groupTypes.add(row.value)
      }
    }

    const { data } = await supabase
      .from('groups')
      .select('location, industries, group_type')
      .limit(2000)

    for (const row of data ?? []) {
      if (row.location?.trim()) locations.add(row.location.trim())
      if (row.group_type?.trim()) groupTypes.add(row.group_type.trim())
      for (const industry of row.industries ?? []) {
        if (industry?.trim()) industries.add(industry.trim())
      }
    }

    if (!groupTypes.size) {
      groupTypes.add(GROUP_TYPES.PUBLIC)
      groupTypes.add(GROUP_TYPES.PRIVATE)
    }

    return ok({
      locations: sorted(locations),
      industries: sorted(industries),
      groupTypes: sorted(groupTypes),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function getGroupPlatformStats(): Promise<
  GroupServiceResponse<GroupPlatformStats>
> {
  try {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [
      totalRes,
      publicRes,
      privateRes,
      monthRes,
      membersRes,
      pendingRes,
    ] = await Promise.all([
      supabase.from('groups').select('id', { count: 'exact', head: true }),
      supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .eq('group_type', GROUP_TYPES.PUBLIC),
      supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .eq('group_type', GROUP_TYPES.PRIVATE),
      supabase
        .from('groups')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('group_join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    if (totalRes.error) return fail(totalRes.error)

    return ok({
      totalGroups: totalRes.count ?? 0,
      publicGroups: publicRes.count ?? 0,
      privateGroups: privateRes.count ?? 0,
      groupsThisMonth: monthRes.count ?? 0,
      totalMembers: membersRes.count ?? 0,
      pendingJoinRequests: pendingRes.count ?? 0,
    })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// AVATAR / COVER STORAGE (post-images bucket)
// ============================================================================

async function uploadGroupImage(
  kind: 'avatar' | 'cover',
  file: GroupImageUploadFile,
  groupId?: string,
): Promise<GroupServiceResponse<{ url: string; path: string }>> {
  try {
    const userId = await requireUserId()
    const blocked = await blockedImageMessage({ mimeType: file.mimeType, body: file.blob })
    if (blocked) return fail(blocked)
    const ext = file.fileName.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') ?? 'jpeg'
    const folder = groupId ?? 'unsaved'
    const prefix = kind === 'avatar' ? 'group-avatars' : 'group-covers'
    const storagePath = `${userId}/community-groups/${prefix}/${folder}/${kind}_${Date.now()}.${ext}`

    const upload = await uploadStorageObject(
      GROUP_MEDIA_BUCKET,
      storagePath,
      file.blob,
      file.mimeType,
      { maxBytes: GROUP_IMAGE_MAX_BYTES },
    )
    if (upload.error || !upload.data) return fail(upload.error ?? 'Upload failed')

    return ok({ url: upload.data.publicUrl, path: storagePath })
  } catch (error) {
    return fail(error)
  }
}

export async function uploadGroupAvatar(
  file: GroupImageUploadFile,
  groupId?: string,
): Promise<GroupServiceResponse<{ url: string; path: string }>> {
  return uploadGroupImage('avatar', file, groupId)
}

export async function uploadGroupCover(
  file: GroupImageUploadFile,
  groupId?: string,
): Promise<GroupServiceResponse<{ url: string; path: string }>> {
  return uploadGroupImage('cover', file, groupId)
}

async function removeStorageByPublicUrl(
  publicUrl: string | null | undefined,
): Promise<GroupServiceResponse<{ removed: boolean }>> {
  try {
    if (!publicUrl || typeof publicUrl !== 'string') return ok({ removed: false })

    const marker = `/storage/v1/object/public/${GROUP_MEDIA_BUCKET}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return ok({ removed: false })

    const storagePath = decodeURIComponent(publicUrl.slice(idx + marker.length))
    const { error } = await supabase.storage.from(GROUP_MEDIA_BUCKET).remove([storagePath])
    if (error) return fail(error)
    return ok({ removed: true })
  } catch (error) {
    return fail(error)
  }
}

export async function deleteGroupAvatar(
  publicUrl: string | null | undefined,
): Promise<GroupServiceResponse<{ removed: boolean }>> {
  return removeStorageByPublicUrl(publicUrl)
}

export async function deleteGroupCover(
  publicUrl: string | null | undefined,
): Promise<GroupServiceResponse<{ removed: boolean }>> {
  return removeStorageByPublicUrl(publicUrl)
}

export function getGroupMediaPublicUrl(path: string): string {
  return getStoragePublicUrl(GROUP_MEDIA_BUCKET, path)
}
