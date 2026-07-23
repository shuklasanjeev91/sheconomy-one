/**
 * Profile service — typed data-access layer for everything profile related.
 *
 * Ported from the legacy `profile-service.js` and adapted to the new schema
 * (`experiences` / `education` / `skills` tables, `is_deleted` soft-delete flag,
 * `saved_posts.collection_name`). Follows, connections and profile-detail reads
 * are delegated to the existing community modules so nothing is duplicated.
 */

import type { User } from '@supabase/supabase-js'

import {
  fetchConnectionState,
  fetchNetworkSummary,
  respondToConnection,
  sendConnectionRequest,
  type NetworkMember,
  type ProfileConnectionState,
} from '~/community/lib/network'
import {
  fetchProfileFollowState,
  followProfile,
  unfollowProfile,
} from '~/community/lib/profile-follows'
import { fetchProfileDetails } from '~/community/lib/profile-details'
import { refreshProfiles } from '~/lib/profile/refresh'
import { supabase } from '~/lib/supabase'
import {
  getStoragePublicUrl,
  uploadStorageObject,
  type UploadProgressHandler,
} from '~/lib/supabase/storage-upload'

import {
  PROFILE_MEDIA_BUCKET,
  type Collection,
  type CompleteProfile,
  type EducationInput,
  type ExperienceInput,
  type Profile,
  type ProfileInsert,
  type ProfileDiscoveryFilters,
  type ProfileEducation,
  type ProfileExperience,
  type ProfileImageType,
  type ProfileImageUpload,
  type ProfileSearchFilters,
  type ProfileSkill,
  type ProfileSummary,
  type ProfileUpdate,
  type SavedPost,
  type ServiceResponse,
  type SkillInput,
  type VerificationStatus,
  type VerificationUpdate,
} from './profile.type'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T): ServiceResponse<T> {
  return { data, error: null, success: true }
}

function fail<T>(error: string, data: T | null = null): ServiceResponse<T> {
  return { data, error, success: false }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}

const PROFILE_SUMMARY_SELECT =
  'id, username, full_name, avatar_url, occupation, business_name, location, bio, is_verified, follower_count'

// ============= CACHING & DEDUPLICATION =============

const CACHE_TTL = 30_000

type CacheEntry<T> = { data: T; timestamp: number }

const profileCache = new Map<string, CacheEntry<Profile>>()
const completionScoreCache = new Map<string, CacheEntry<number>>()
const pendingRequests = new Map<string, Promise<unknown>>()

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  cache.delete(key)
  return null
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

function deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  const existing = pendingRequests.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, promise)
  return promise
}

/** Clear cached profile / completion data for a single user, or everyone. */
export function clearProfileCache(userId?: string): void {
  if (userId) {
    profileCache.delete(userId)
    completionScoreCache.delete(userId)
  } else {
    profileCache.clear()
    completionScoreCache.clear()
  }
}

// ============= CORE PROFILE OPERATIONS =============

export async function getProfile(userId: string): Promise<ServiceResponse<Profile | null>> {
  if (!userId) return fail('User ID required')

  const cached = getCached(profileCache, userId)
  if (cached) return ok(cached)

  return deduplicateRequest(`profile-${userId}`, async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) return fail<Profile | null>(error.message)
      if (data) setCache(profileCache, userId, data)
      return ok<Profile | null>(data)
    } catch (error) {
      return fail<Profile | null>(toMessage(error))
    }
  })
}

export async function getCompleteProfile(
  userId: string,
): Promise<ServiceResponse<CompleteProfile>> {
  if (!userId) return fail('User ID required')

  try {
    const [profileRes, detailsRes] = await Promise.all([
      getProfile(userId),
      fetchProfileDetails(userId),
    ])

    return ok<CompleteProfile>({
      profile: profileRes.data,
      experiences: detailsRes.data.experiences,
      education: detailsRes.data.education,
      skills: detailsRes.data.skills,
      languages: detailsRes.data.languages,
    })
  } catch (error) {
    return fail<CompleteProfile>(toMessage(error))
  }
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<ServiceResponse<Profile>> {
  if (!userId) return fail('User ID required')

  try {
    clearProfileCache(userId)

    const payload: ProfileUpdate = { ...updates, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single()

    if (error) return fail<Profile>(error.message)
    if (data) {
      setCache(profileCache, userId, data)
      refreshProfiles()
    }
    return ok(data)
  } catch (error) {
    return fail<Profile>(toMessage(error))
  }
}

export async function upsertProfile(
  userId: string,
  profileData: ProfileUpdate,
): Promise<ServiceResponse<Profile>> {
  if (!userId) return fail('User ID required')

  try {
    clearProfileCache(userId)

    // `username` is required by the generated Insert type but is optional for an
    // upsert against an existing row; the explicit type keeps the call type-safe.
    const payload = {
      id: userId,
      ...profileData,
      updated_at: new Date().toISOString(),
    } as ProfileInsert

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .single()

    if (error) return fail<Profile>(error.message)
    if (data) {
      setCache(profileCache, userId, data)
      refreshProfiles()
    }
    return ok(data)
  } catch (error) {
    return fail<Profile>(toMessage(error))
  }
}

// ============= AVATARS & MEDIA =============

function extensionForUpload(file: ProfileImageUpload): string {
  const fromName = file.fileName?.split('.').pop()
  if (fromName) return fromName
  if (file.mimeType.includes('png')) return 'png'
  if (file.mimeType.includes('webp')) return 'webp'
  if (file.mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

export async function uploadImage(
  userId: string,
  file: ProfileImageUpload,
  type: ProfileImageType = 'avatar',
  options?: { onProgress?: UploadProgressHandler },
): Promise<ServiceResponse<Pick<Profile, 'avatar_url' | 'cover_url'>>> {
  if (!userId) return fail('User ID required')

  try {
    const ext = extensionForUpload(file)
    const path = `${userId}/${type}-${Date.now()}.${ext}`

    const { data: uploaded, error: uploadError } = await uploadStorageObject(
      PROFILE_MEDIA_BUCKET,
      path,
      file.blob,
      file.mimeType,
      { onProgress: options?.onProgress },
    )

    if (uploadError || !uploaded) {
      return fail(uploadError ?? 'Upload failed.')
    }

    const publicUrl = uploaded.publicUrl || getStoragePublicUrl(PROFILE_MEDIA_BUCKET, path)
    const isCover = type === 'cover'
    const update: ProfileUpdate = isCover ? { cover_url: publicUrl } : { avatar_url: publicUrl }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)

    if (updateError) return fail(updateError.message)

    clearProfileCache(userId)
    refreshProfiles()

    return ok({
      avatar_url: isCover ? null : publicUrl,
      cover_url: isCover ? publicUrl : null,
    })
  } catch (error) {
    return fail(toMessage(error))
  }
}

// ============= EXPERIENCES =============

export async function addExperience(
  userId: string,
  experience: ExperienceInput,
): Promise<ServiceResponse<ProfileExperience>> {
  try {
    const { data, error } = await supabase
      .from('experiences')
      .insert({ user_id: userId, ...experience })
      .select()
      .single()

    return error ? fail<ProfileExperience>(error.message) : ok(data as ProfileExperience)
  } catch (error) {
    return fail<ProfileExperience>(toMessage(error))
  }
}

export async function updateExperience(
  experienceId: string,
  updates: Partial<ExperienceInput>,
): Promise<ServiceResponse<ProfileExperience>> {
  try {
    const { data, error } = await supabase
      .from('experiences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', experienceId)
      .select()
      .single()

    return error ? fail<ProfileExperience>(error.message) : ok(data as ProfileExperience)
  } catch (error) {
    return fail<ProfileExperience>(toMessage(error))
  }
}

export async function deleteExperience(experienceId: string): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.from('experiences').delete().eq('id', experienceId)
    return error ? fail(error.message) : ok(null)
  } catch (error) {
    return fail(toMessage(error))
  }
}

// ============= EDUCATION =============

export async function addEducation(
  userId: string,
  education: EducationInput,
): Promise<ServiceResponse<ProfileEducation>> {
  try {
    const { data, error } = await supabase
      .from('education')
      .insert({ user_id: userId, ...education })
      .select()
      .single()

    return error ? fail<ProfileEducation>(error.message) : ok(data as ProfileEducation)
  } catch (error) {
    return fail<ProfileEducation>(toMessage(error))
  }
}

export async function updateEducation(
  educationId: string,
  updates: Partial<EducationInput>,
): Promise<ServiceResponse<ProfileEducation>> {
  try {
    const { data, error } = await supabase
      .from('education')
      .update(updates)
      .eq('id', educationId)
      .select()
      .single()

    return error ? fail<ProfileEducation>(error.message) : ok(data as ProfileEducation)
  } catch (error) {
    return fail<ProfileEducation>(toMessage(error))
  }
}

export async function deleteEducation(educationId: string): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.from('education').delete().eq('id', educationId)
    return error ? fail(error.message) : ok(null)
  } catch (error) {
    return fail(toMessage(error))
  }
}

// ============= SKILLS =============

export async function addSkill(
  userId: string,
  skill: SkillInput,
): Promise<ServiceResponse<ProfileSkill>> {
  try {
    const { data, error } = await supabase
      .from('skills')
      .insert({ user_id: userId, ...skill })
      .select()
      .single()

    return error ? fail<ProfileSkill>(error.message) : ok(data as ProfileSkill)
  } catch (error) {
    return fail<ProfileSkill>(toMessage(error))
  }
}

export async function deleteSkill(skillId: string): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.from('skills').delete().eq('id', skillId)
    return error ? fail(error.message) : ok(null)
  } catch (error) {
    return fail(toMessage(error))
  }
}

// ============= USER DISCOVERY =============

export async function getAllProfiles(
  excludeUserId: string | null = null,
  filters: ProfileDiscoveryFilters = {},
): Promise<ServiceResponse<Profile[]>> {
  try {
    let query = supabase.from('profiles').select('*').eq('is_deleted', false)

    if (excludeUserId) query = query.neq('id', excludeUserId)
    if (filters.roles?.length) query = query.in('role', filters.roles)
    if (typeof filters.gender === 'boolean') query = query.eq('gender', filters.gender)
    if (filters.isVerified) query = query.eq('is_verified', true)
    if (filters.onlyActive !== false) query = query.eq('is_active', true)

    if (typeof filters.page === 'number' && typeof filters.limit === 'number') {
      const from = filters.page * filters.limit
      query = query.range(from, from + filters.limit - 1)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    return error ? fail<Profile[]>(error.message, []) : ok(data ?? [])
  } catch (error) {
    return fail<Profile[]>(toMessage(error), [])
  }
}

export async function searchUsers(
  term: string,
  filters: ProfileSearchFilters = {},
  limit = 20,
): Promise<ServiceResponse<ProfileSummary[]>> {
  try {
    let query = supabase
      .from('profiles')
      .select(PROFILE_SUMMARY_SELECT)
      .eq('is_active', true)
      .eq('is_deleted', false)

    if (term?.trim()) {
      const escaped = `%${term.trim()}%`
      query = query.or(
        `username.ilike.${escaped},full_name.ilike.${escaped},business_name.ilike.${escaped}`,
      )
    }

    if (filters.verified) query = query.eq('is_verified', true)
    if (filters.location) query = query.ilike('location', `%${filters.location}%`)

    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      followers: { column: 'follower_count', ascending: false },
      newest: { column: 'created_at', ascending: false },
      name: { column: 'full_name', ascending: true },
    }
    const sort = sortMap[filters.sortBy ?? 'newest'] ?? sortMap.newest

    const { data, error } = await query
      .order(sort.column, { ascending: sort.ascending })
      .limit(limit)

    return error
      ? fail<ProfileSummary[]>(error.message, [])
      : ok((data ?? []) as ProfileSummary[])
  } catch (error) {
    return fail<ProfileSummary[]>(toMessage(error), [])
  }
}

export async function getUserSuggestions(
  currentUserId: string,
  limit = 10,
): Promise<ServiceResponse<ProfileSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SUMMARY_SELECT)
      .neq('id', currentUserId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .in('role', ['U', 'V'])
      .eq('gender', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    return error
      ? fail<ProfileSummary[]>(error.message, [])
      : ok((data ?? []) as ProfileSummary[])
  } catch (error) {
    return fail<ProfileSummary[]>(toMessage(error), [])
  }
}

export async function getVerifiedUsers(limit = 12): Promise<ServiceResponse<ProfileSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SUMMARY_SELECT)
      .eq('is_verified', true)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('follower_count', { ascending: false })
      .limit(limit)

    return error
      ? fail<ProfileSummary[]>(error.message, [])
      : ok((data ?? []) as ProfileSummary[])
  } catch (error) {
    return fail<ProfileSummary[]>(toMessage(error), [])
  }
}

// ============= VERIFICATION =============

export async function checkVerificationStatus(
  userId: string,
): Promise<ServiceResponse<VerificationStatus>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_verified, gender, verification_attempts, last_verification_attempt')
      .eq('id', userId)
      .maybeSingle()

    if (error) return fail<VerificationStatus>(error.message)

    return ok<VerificationStatus>({
      needsVerification: !data?.is_verified,
      isVerified: data?.is_verified ?? false,
      gender: data?.gender ?? null,
      verificationAttempts: data?.verification_attempts ?? 0,
      lastAttempt: data?.last_verification_attempt ?? null,
    })
  } catch (error) {
    return fail<VerificationStatus>(toMessage(error))
  }
}

export async function updateVerificationStatus(
  userId: string,
  verification: VerificationUpdate,
): Promise<ServiceResponse<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_verified: verification.isVerified,
        gender: verification.gender,
        verification_attempts: verification.attempts ?? 0,
        last_verification_attempt: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) return fail<Profile>(error.message)
    clearProfileCache(userId)
    refreshProfiles()
    return ok(data)
  } catch (error) {
    return fail<Profile>(toMessage(error))
  }
}

// ============= PROFILE COMPLETION & ANALYTICS =============

export async function getProfileCompletionScore(
  userId: string,
): Promise<ServiceResponse<number>> {
  if (!userId) return fail('User ID required', 0)

  const cached = getCached(completionScoreCache, userId)
  if (cached !== null) return ok(cached)

  return deduplicateRequest(`completion-${userId}`, async () => {
    try {
      const { data, error } = await supabase.rpc('calculate_profile_completion', {
        profile_id: userId,
      })

      if (error) {
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          return ok(0)
        }
        return fail<number>(error.message, 0)
      }

      const score = data ?? 0
      setCache(completionScoreCache, userId, score)
      return ok(score)
    } catch (error) {
      return fail<number>(toMessage(error), 0)
    }
  })
}

export async function recordProfileView(
  profileUserId: string,
  viewerUserId: string | null = null,
): Promise<ServiceResponse<null>> {
  try {
    await supabase.from('profile_views').insert({
      profile_user_id: profileUserId,
      viewer_user_id: viewerUserId,
    })
  } catch {
    // Analytics write — never surface as an error to the caller.
  }
  return ok(null)
}

// ============= ACCOUNT LIFECYCLE =============

function deriveUsername(user: User): string {
  const fromMeta = (user.user_metadata?.username as string | undefined)?.trim()
  if (fromMeta) return fromMeta
  const local = user.email?.split('@')[0]?.replace(/[^a-z0-9_]/gi, '') || 'user'
  return `${local}_${user.id.slice(0, 8)}`.toLowerCase()
}

export async function createInitialProfile(user: User): Promise<ServiceResponse<Profile>> {
  if (!user) return fail('No user provided')

  return upsertProfile(user.id, {
    email: user.email ?? null,
    phone: user.phone ?? null,
    username: deriveUsername(user),
    full_name: (user.user_metadata?.full_name as string | undefined) ?? '',
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? '',
  })
}

export async function softDeleteProfile(
  userId: string,
  reason = 'User requested deletion',
): Promise<ServiceResponse<Profile>> {
  try {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        account_status: 'inactive',
        device_info: {
          deletion_scheduled_at: now.toISOString(),
          deletion_scheduled_for: scheduledFor.toISOString(),
          deletion_reason: reason,
        },
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) return fail<Profile>(error.message)
    clearProfileCache(userId)
    refreshProfiles()
    return ok(data)
  } catch (error) {
    return fail<Profile>(toMessage(error))
  }
}

export async function cancelProfileDeletion(userId: string): Promise<ServiceResponse<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: true, account_status: 'active', device_info: {} })
      .eq('id', userId)
      .eq('account_status', 'inactive')
      .select()
      .single()

    if (error) return fail<Profile>(error.message)
    clearProfileCache(userId)
    refreshProfiles()
    return ok(data)
  } catch (error) {
    return fail<Profile>(toMessage(error))
  }
}

export async function blockUser(
  currentUserId: string,
  targetUserId: string,
): Promise<ServiceResponse<null>> {
  try {
    const { error: blockError } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: currentUserId, blocked_id: targetUserId })

    if (blockError) return fail(blockError.message)

    await supabase
      .from('connections')
      .delete()
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`,
      )

    return ok(null)
  } catch (error) {
    return fail(toMessage(error))
  }
}

// ============= CONNECTIONS (delegates to community/lib/network) =============

export async function getConnections(userId: string): Promise<ServiceResponse<NetworkMember[]>> {
  try {
    const summary = await fetchNetworkSummary(userId)
    return summary.error ? fail(summary.error, summary.connections) : ok(summary.connections)
  } catch (error) {
    return fail<NetworkMember[]>(toMessage(error), [])
  }
}

export async function getPendingConnections(
  userId: string,
): Promise<ServiceResponse<NetworkMember[]>> {
  try {
    const summary = await fetchNetworkSummary(userId)
    return summary.error
      ? fail(summary.error, summary.pendingReceived)
      : ok(summary.pendingReceived)
  } catch (error) {
    return fail<NetworkMember[]>(toMessage(error), [])
  }
}

export async function requestConnection(
  senderId: string,
  receiverId: string,
): Promise<ServiceResponse<string>> {
  const { connectionId, error } = await sendConnectionRequest(senderId, receiverId)
  return error ? fail<string>(error) : ok(connectionId ?? '')
}

export async function acceptConnection(connectionId: string): Promise<ServiceResponse<null>> {
  const { error } = await respondToConnection(connectionId, 'accepted')
  return error ? fail(error) : ok(null)
}

export async function rejectConnection(connectionId: string): Promise<ServiceResponse<null>> {
  const { error } = await respondToConnection(connectionId, 'rejected')
  return error ? fail(error) : ok(null)
}

export async function checkConnectionStatus(
  userId: string,
  otherUserId: string,
): Promise<ServiceResponse<ProfileConnectionState>> {
  try {
    const state = await fetchConnectionState(userId, otherUserId)
    return ok(state)
  } catch (error) {
    return fail<ProfileConnectionState>(toMessage(error))
  }
}

// ============= FOLLOWS (delegates to community/lib/profile-follows) =============

export async function followUser(
  senderId: string,
  receiverId: string,
): Promise<ServiceResponse<null>> {
  try {
    const { isFollowing } = await fetchProfileFollowState(senderId, receiverId)
    if (isFollowing) return fail('Already following')

    const { error } = await followProfile(senderId, receiverId)
    return error ? fail(error) : ok(null)
  } catch (error) {
    return fail(toMessage(error))
  }
}

export async function unfollowUser(
  senderId: string,
  receiverId: string,
): Promise<ServiceResponse<null>> {
  const { error } = await unfollowProfile(senderId, receiverId)
  return error ? fail(error) : ok(null)
}

// ============= COLLECTIONS & SAVED POSTS =============

export async function getCollections(userId: string): Promise<ServiceResponse<Collection[]>> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return error ? fail<Collection[]>(error.message, []) : ok(data ?? [])
  } catch (error) {
    return fail<Collection[]>(toMessage(error), [])
  }
}

export async function createCollection(
  userId: string,
  name: string,
): Promise<ServiceResponse<Collection>> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: userId, name })
      .select()
      .single()

    return error ? fail<Collection>(error.message) : ok(data)
  } catch (error) {
    return fail<Collection>(toMessage(error))
  }
}

export async function getSavedPosts(userId: string): Promise<ServiceResponse<SavedPost[]>> {
  try {
    const { data, error } = await supabase
      .from('saved_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return error ? fail<SavedPost[]>(error.message, []) : ok(data ?? [])
  } catch (error) {
    return fail<SavedPost[]>(toMessage(error), [])
  }
}

export async function savePost(
  userId: string,
  postId: string,
  collectionNames: string[] = [],
): Promise<ServiceResponse<SavedPost[]>> {
  try {
    const rows =
      collectionNames.length > 0
        ? collectionNames.map((collectionName) => ({
            user_id: userId,
            post_id: postId,
            collection_name: collectionName,
          }))
        : [{ user_id: userId, post_id: postId }]

    const { data, error } = await supabase.from('saved_posts').insert(rows).select()

    return error ? fail<SavedPost[]>(error.message, []) : ok(data ?? [])
  } catch (error) {
    return fail<SavedPost[]>(toMessage(error), [])
  }
}
