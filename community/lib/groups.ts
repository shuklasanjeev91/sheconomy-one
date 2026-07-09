import { supabase } from '~/lib/supabase/client'

export const GROUP_PAGE_SIZE = 20

export type Group = {
  id: string
  name: string
  title: string
  description: string | null
  rules: string | null
  avatar_url: string | null
  cover_url: string | null
  group_type: string | null
  location: string | null
  industries: string[] | null
  members_count: number | null
  created_by: string | null
  created_at: string | null
  allow_invites: boolean | null
  require_post_review: boolean | null
}

export type GroupMember = {
  id: string
  group_id: string | null
  user_id: string | null
  role: string | null
  status: string | null
  joined_at: string | null
  profile?: {
    full_name: string | null
    username: string
    avatar_url: string | null
    headline: string | null
  } | null
}

export async function fetchGroup(id: string): Promise<{ data: Group | null; error: string | null }> {
  const { data, error } = await supabase.from('groups').select('*').eq('id', id).maybeSingle()
  return { data: (data as Group | null) ?? null, error: error?.message ?? null }
}

export async function fetchGroups(
  page = 0,
  search = '',
): Promise<{ items: Group[]; hasMore: boolean; error: string | null }> {
  const from = page * GROUP_PAGE_SIZE
  const to = from + GROUP_PAGE_SIZE - 1

  let query = supabase
    .from('groups')
    .select('*', { count: 'exact' })
    .order('members_count', { ascending: false, nullsFirst: false })

  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,title.ilike.%${search.trim()}%`)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) return { items: [], hasMore: false, error: error.message }

  const total = count ?? 0
  return {
    items: (data ?? []) as Group[],
    hasMore: total ? to + 1 < total : (data?.length ?? 0) === GROUP_PAGE_SIZE,
    error: null,
  }
}

export async function fetchMyGroups(userId: string): Promise<Group[]> {
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const groupIds = (memberships ?? []).map((m) => m.group_id).filter(Boolean) as string[]
  if (!groupIds.length) return []

  const { data } = await supabase.from('groups').select('*').in('id', groupIds)
  return (data ?? []) as Group[]
}

export type CreateGroupInput = {
  name: string
  title: string
  description?: string
  rules?: string
  groupType?: 'public' | 'private'
  location?: string
  avatarUrl?: string
  coverUrl?: string
}

export async function createGroup(
  userId: string,
  input: CreateGroupInput,
): Promise<{ data: Group | null; error: string | null }> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: input.name.trim(),
      title: input.title.trim(),
      description: input.description ?? null,
      rules: input.rules ?? null,
      group_type: input.groupType ?? 'public',
      location: input.location ?? null,
      avatar_url: input.avatarUrl ?? null,
      cover_url: input.coverUrl ?? null,
      created_by: userId,
      members_count: 1,
    })
    .select('*')
    .maybeSingle()

  if (!error && data) {
    await supabase.from('group_members').insert({
      group_id: data.id,
      user_id: userId,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
  }

  return { data: (data as Group | null) ?? null, error: error?.message ?? null }
}

export async function fetchGroupMembership(
  groupId: string,
  userId: string,
): Promise<{ isMember: boolean; isPending: boolean; role: string | null }> {
  const [{ data: member }, { data: request }] = await Promise.all([
    supabase
      .from('group_members')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('group_join_requests')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle(),
  ])

  return {
    isMember: member?.status === 'active',
    isPending: !!request,
    role: member?.role ?? null,
  }
}

export async function joinGroup(
  groupId: string,
  userId: string,
  groupType: string | null,
): Promise<{ error: string | null; pending?: boolean }> {
  if (groupType === 'private') {
    const { error } = await supabase.from('group_join_requests').insert({
      group_id: groupId,
      user_id: userId,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
    return { error: error?.message ?? null, pending: true }
  }

  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
    status: 'active',
    joined_at: new Date().toISOString(),
  })
  return { error: error?.message ?? null }
}

export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, status, joined_at')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const userIds = (data ?? []).map((m) => m.user_id).filter(Boolean) as string[]
  if (!userIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, headline')
    .in('id', userIds)

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  return (data ?? []).map((member) => ({
    ...member,
    profile: member.user_id ? profileById.get(member.user_id) ?? null : null,
  }))
}

export async function fetchMemberGroupIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  return (data ?? []).map((m) => m.group_id).filter(Boolean) as string[]
}

export type GroupJoinRequest = {
  id: string
  user_id: string
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
  requested_at: string | null
}

export async function fetchGroupJoinRequests(groupId: string): Promise<GroupJoinRequest[]> {
  const { data } = await supabase
    .from('group_join_requests')
    .select('id, user_id, requested_at')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  const userIds = (data ?? []).map((row) => row.user_id).filter(Boolean) as string[]
  if (!userIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, headline, avatar_url')
    .in('id', userIds)

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return (data ?? [])
    .filter((row) => row.user_id)
    .map((row) => {
      const profile = profileById.get(row.user_id!)
      return {
        id: row.id,
        user_id: row.user_id!,
        username: profile?.username ?? null,
        full_name: profile?.full_name ?? profile?.username ?? 'Member',
        headline: profile?.headline ?? null,
        avatar_url: profile?.avatar_url ?? null,
        requested_at: row.requested_at,
      }
    })
}

export async function respondToGroupJoinRequest(
  requestId: string,
  groupId: string,
  userId: string,
  approve: boolean,
): Promise<{ error: string | null }> {
  const { data: request } = await supabase
    .from('group_join_requests')
    .select('user_id, group_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request?.user_id || request.group_id !== groupId) {
    return { error: 'Join request not found.' }
  }

  const { data: admin } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (admin?.role !== 'admin') {
    return { error: 'Only group admins can manage requests.' }
  }

  const status = approve ? 'approved' : 'rejected'
  const { error: updateError } = await supabase
    .from('group_join_requests')
    .update({ status })
    .eq('id', requestId)

  if (updateError) return { error: updateError.message }

  if (approve) {
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: request.user_id,
      role: 'member',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    if (memberError) return { error: memberError.message }
  }

  return { error: null }
}

export type UpdateGroupInput = Partial<{
  title: string
  description: string
  rules: string
  location: string
  groupType: 'public' | 'private'
  avatarUrl: string
  coverUrl: string
}>

export async function updateGroup(
  groupId: string,
  userId: string,
  input: UpdateGroupInput,
): Promise<{ error: string | null }> {
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (membership?.role !== 'admin') {
    return { error: 'Only group admins can edit this group.' }
  }

  const { error } = await supabase
    .from('groups')
    .update({
      title: input.title?.trim(),
      description: input.description ?? null,
      rules: input.rules ?? null,
      location: input.location ?? null,
      group_type: input.groupType,
      avatar_url: input.avatarUrl ?? null,
      cover_url: input.coverUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)

  return { error: error?.message ?? null }
}

export async function fetchGroupAdminUserIds(groupId: string): Promise<string[]> {
  const { data } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .eq('role', 'admin')

  return (data ?? []).map((row) => row.user_id).filter(Boolean) as string[]
}
