/**
 * Community Groups — shared types + constants (admin-first).
 *
 * Typed against `Tables<'groups'>`. Related: `group_members`,
 * `group_join_requests`, `group_invitations`, `posts.group_id`.
 */

import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'
import { STORAGE_BUCKETS } from '~/lib/supabase/storage-upload'

// ============= SERVICE RESPONSE =============

export type GroupServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
  meta?: GroupPaginationMeta
}

export type GroupPaginationMeta = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// ============= TABLE ROW TYPES =============

export type Group = Tables<'groups'>
export type GroupInsert = TablesInsert<'groups'>
export type GroupUpdate = TablesUpdate<'groups'>

export type GroupMemberRow = Tables<'group_members'>
export type GroupJoinRequestRow = Tables<'group_join_requests'>
export type GroupInvitationRow = Tables<'group_invitations'>

// ============= JOIN / UI SHAPES =============

export type GroupCreatorRef = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  email: string | null
  headline: string | null
}

/** Admin list row with live member/post/pending counts. */
export type GroupWithCounts = Group & {
  member_count: number
  post_count: number
  pending_request_count: number
  creator?: GroupCreatorRef | null
}

export type GroupMemberRole = 'admin' | 'member'
export type GroupMemberStatus = 'active' | 'approved' | string

export type GroupMemberWithProfile = {
  id: string
  group_id: string
  user_id: string
  role: GroupMemberRole | string
  status: string
  joined_at: string | null
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
}

export type GroupJoinRequestWithProfile = {
  id: string
  group_id: string
  user_id: string
  status: string
  requested_at: string | null
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
}

export type GroupInvitationWithProfile = {
  id: string
  group_id: string
  invited_by: string | null
  invited_user_id: string | null
  message: string | null
  status: string | null
  created_at: string | null
  responded_at: string | null
  invitee_username: string | null
  invitee_full_name: string | null
  invitee_avatar_url: string | null
}

export type GroupEngagementStats = {
  total_reactions: number
  total_comments: number
  total_views: number
  like_count: number
  love_count: number
  celebrate_count: number
  support_count: number
  insightful_count: number
  funny_count: number
}

/** Full admin detail payload. */
export type GroupDetail = GroupWithCounts & {
  members: GroupMemberWithProfile[]
  join_requests: GroupJoinRequestWithProfile[]
  invitations: GroupInvitationWithProfile[]
  engagement: GroupEngagementStats
}

export type GroupPlatformStats = {
  totalGroups: number
  publicGroups: number
  privateGroups: number
  groupsThisMonth: number
  totalMembers: number
  pendingJoinRequests: number
}

export type GroupFacets = {
  locations: string[]
  industries: string[]
  groupTypes: string[]
}

// ============= ENUMS / CONSTANTS =============

export const GROUP_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  SECRET: 'secret',
} as const
export type GroupType = (typeof GROUP_TYPES)[keyof typeof GROUP_TYPES]

/** Types offered in the admin UI (secret kept for legacy rows). */
export const GROUP_TYPE_OPTIONS = [
  GROUP_TYPES.PUBLIC,
  GROUP_TYPES.PRIVATE,
  GROUP_TYPES.SECRET,
] as const

export const GROUP_MEMBER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const

export const DEFAULT_GROUP_TYPE = GROUP_TYPES.PUBLIC
export const DEFAULT_GROUP_LIMIT = 20

/** Reuse the existing public `post-images` bucket (owner-scoped paths). */
export const GROUP_MEDIA_BUCKET = STORAGE_BUCKETS.postImages

export const GROUP_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const GROUP_IMAGE_ACCEPTED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

// ============= INPUT TYPES =============

export type CreateGroupInput = {
  name: string
  title: string
  description?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  members_count?: number | null
  industries?: string[] | null
  location?: string | null
  rules?: string | null
  group_type?: string | null
  allow_invites?: boolean | null
  require_post_review?: boolean | null
  created_by?: string | null
  raw_group_data?: Record<string, unknown> | null
}

export type UpdateGroupInput = Partial<CreateGroupInput>

export type GroupListFilters = {
  search?: string
  group_type?: string
  location?: string
  industry?: string
  created_by?: string
}

export type GroupListParams = {
  filters?: GroupListFilters
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'updated_at' | 'members_count' | 'name' | 'title'
  ascending?: boolean
}

export type GroupImageUploadFile = {
  blob: Blob
  mimeType: string
  fileName: string
  fileSize: number
}
