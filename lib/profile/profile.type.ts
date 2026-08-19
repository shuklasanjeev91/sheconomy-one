import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'
import type {
  ProfileEducation,
  ProfileExperience,
  ProfileSkill,
  ProfileLanguage,
} from '~/community/lib/profile-details'

/**
 * Shared shape returned by every profile service call.
 * Mirrors the old `createResponse` helper but fully typed.
 */
export type ServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

/**
 * Full row / insert / update helpers for the `profiles` table.
 * `search_tokens` / `search_vector` are DB-generated (typed `unknown`) and are
 * never written from the client, so they are excluded from the write helpers.
 */
export type Profile = Tables<'profiles'>
export type ProfileInsert = Omit<TablesInsert<'profiles'>, 'search_tokens' | 'search_vector'>
export type ProfileUpdate = Omit<TablesUpdate<'profiles'>, 'search_tokens' | 'search_vector'>


/** Re-export detail row types so profile consumers have a single import surface. */
export type { ProfileExperience, ProfileEducation, ProfileSkill, ProfileLanguage }

/** Input payloads (the caller never supplies `id` / `user_id` / timestamps). */
export type ExperienceInput = Omit<
  TablesInsert<'experiences'>,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>
export type EducationInput = Omit<
  TablesInsert<'education'>,
  'id' | 'user_id' | 'created_at'
>
export type SkillInput = Omit<TablesInsert<'skills'>, 'id' | 'user_id' | 'created_at'>

export type Collection = Tables<'collections'>
export type SavedPost = Tables<'saved_posts'>

/** Aggregated profile + related records, used by `getCompleteProfile`. */
export type CompleteProfile = {
  profile: Profile | null
  experiences: ProfileExperience[]
  education: ProfileEducation[]
  skills: ProfileSkill[]
  languages: ProfileLanguage[]
}

/** Compact profile shape returned by discovery / search / suggestion queries. */
export type ProfileSummary = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'full_name'
  | 'avatar_url'
  | 'occupation'
  | 'business_name'
  | 'location'
  | 'bio'
  | 'is_verified'
  | 'follower_count'
>

export type ProfileDiscoveryFilters = {
  roles?: string[]
  gender?: boolean
  isVerified?: boolean
  onlyActive?: boolean
  page?: number
  limit?: number
}

export type ProfileSearchSort = 'followers' | 'newest' | 'name'

export type ProfileSearchFilters = {
  verified?: boolean
  location?: string
  sortBy?: ProfileSearchSort
}

export type VerificationStatus = {
  isVerified: boolean
  needsVerification: boolean
  gender: boolean | null
  verificationAttempts: number
  lastAttempt: string | null
}

export type VerificationUpdate = {
  isVerified: boolean
  gender: boolean
  attempts?: number
}

/** The kind of image being uploaded to profile storage. */
export type ProfileImageType = 'avatar' | 'cover'

export type ProfileImageUpload = {
  blob: Blob | ArrayBuffer | File
  mimeType: string
  fileName?: string
}

/** Result of `validateProfileData`. */
export type ProfileValidationResult = {
  isValid: boolean
  errors: string[]
}

// ============= CONSTANTS =============

/**
 * Role codes stored in `profiles.role`
 * (`profiles_role_check`: A / V / U / S / L / F).
 */
export const USER_ROLES = {
  ADMIN: 'A',
  VENDOR: 'V',
  USER: 'U',
  SELLER: 'S',
  LOGISTICS: 'L',
  FINANCE: 'F',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.VENDOR]: 'Vendor',
  [USER_ROLES.USER]: 'Member',
  [USER_ROLES.SELLER]: 'Seller',
  [USER_ROLES.LOGISTICS]: 'Logistics',
  [USER_ROLES.FINANCE]: 'Finance',
}

export const PROFILE_ROLES: readonly UserRole[] = [
  USER_ROLES.ADMIN,
  USER_ROLES.VENDOR,
  USER_ROLES.USER,
  USER_ROLES.SELLER,
  USER_ROLES.LOGISTICS,
  USER_ROLES.FINANCE,
]

export const PROFILE_COMPLETION = {
  /** Minimum completion score below which the basic-info modal is shown. */
  MINIMUM_THRESHOLD: 10,
  BASIC_INFO_FIELDS: ['full_name', 'avatar_url', 'bio', 'role'] as const,
} as const

export const PROFILE_VALIDATION = {
  FULL_NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
  BIO: { MAX_LENGTH: 500 },
  BUSINESS_NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
} as const

/** Supabase Storage bucket used for avatar / cover uploads. */
export const PROFILE_MEDIA_BUCKET = 'profile-avatars'

/** Redux-persist keys for the completion slice. */
export const PROFILE_STORAGE_KEYS = {
  BASIC_PROFILE_COMPLETED: 'basic-profile-completed',
  BASIC_PROFILE_SKIPPED: 'basic-profile-skipped',
} as const
