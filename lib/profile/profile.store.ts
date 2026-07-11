/**
 * Redux Toolkit slices for profile state.
 *
 * Replaces the legacy Zustand `profilesStore` and `profileCompletionStore`.
 * Async work lives in `createAsyncThunk`s that wrap `profile.service`; the
 * completion slice is persisted (see `lib/store`).
 */

import { createAsyncThunk, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@supabase/supabase-js'

import type { NetworkMember } from '~/community/lib/network'
import type { AppDispatch } from '~/lib/store'

import * as profileService from './profile.service'
import {
  type Collection,
  type EducationInput,
  type ExperienceInput,
  type Profile,
  type ProfileDiscoveryFilters,
  type ProfileEducation,
  type ProfileExperience,
  type ProfileImageUpload,
  type ProfileSearchFilters,
  type ProfileSkill,
  type ProfileSummary,
  type ProfileUpdate,
  type SavedPost,
  type SkillInput,
  type VerificationUpdate,
} from './profile.type'
import { shouldShowBasicProfileModal } from './profile.utils'

// ============= PROFILE SLICE =============

type EditModalType = 'experience' | 'education' | 'skill' | 'profile' | string

type ProfileState = {
  profile: Profile | null
  experiences: ProfileExperience[]
  education: ProfileEducation[]
  skills: ProfileSkill[]
  connections: NetworkMember[]
  allProfiles: Profile[]
  searchResults: ProfileSummary[]
  collections: Collection[]
  savedPosts: SavedPost[]

  isLoading: boolean
  isSaving: boolean
  error: string | null

  showEditModal: boolean
  editModalType: EditModalType | null
  editModalData: unknown

  verificationStatus: {
    isVerified: boolean
    needsVerification: boolean
    attempts: number
  }

  completionScore: number
}

const initialProfileState: ProfileState = {
  profile: null,
  experiences: [],
  education: [],
  skills: [],
  connections: [],
  allProfiles: [],
  searchResults: [],
  collections: [],
  savedPosts: [],
  isLoading: false,
  isSaving: false,
  error: null,
  showEditModal: false,
  editModalType: null,
  editModalData: null,
  verificationStatus: {
    isVerified: false,
    needsVerification: false,
    attempts: 0,
  },
  completionScore: 0,
}

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch }

/** Resolve a ServiceResponse into thunk data or a rejection. */
async function resolveResponse<T>(
  promise: Promise<{ data: T | null; error: string | null; success: boolean }>,
  rejectWithValue: (value: string) => unknown,
): Promise<T | ReturnType<typeof rejectWithValue>> {
  const response = await promise
  if (!response.success) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return response.data as T
}

export const loadProfile = createAsyncThunk<Profile | null, string, ThunkConfig>(
  'profile/loadProfile',
  (userId, { rejectWithValue }) =>
    resolveResponse(profileService.getProfile(userId), rejectWithValue) as Promise<Profile | null>,
)

export const loadCompleteProfile = createAsyncThunk<
  Awaited<ReturnType<typeof profileService.getCompleteProfile>>['data'],
  string,
  ThunkConfig
>('profile/loadCompleteProfile', async (userId, { rejectWithValue }) => {
  const response = await profileService.getCompleteProfile(userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load profile.')
  return response.data
})

export const updateProfile = createAsyncThunk<
  Profile | null,
  { userId: string; updates: ProfileUpdate },
  ThunkConfig
>('profile/updateProfile', ({ userId, updates }, { rejectWithValue }) =>
  resolveResponse(profileService.updateProfile(userId, updates), rejectWithValue) as Promise<
    Profile | null
  >,
)

export const updateProfileBio = createAsyncThunk<
  Profile | null,
  { userId: string; bio: string },
  ThunkConfig
>('profile/updateProfileBio', ({ userId, bio }, { rejectWithValue }) =>
  resolveResponse(profileService.updateProfile(userId, { bio }), rejectWithValue) as Promise<
    Profile | null
  >,
)

export const uploadAvatar = createAsyncThunk<
  string | null,
  { userId: string; file: ProfileImageUpload },
  ThunkConfig
>('profile/uploadAvatar', async ({ userId, file }, { rejectWithValue }) => {
  const response = await profileService.uploadImage(userId, file, 'avatar')
  if (!response.success) return rejectWithValue(response.error ?? 'Upload failed.')
  return response.data?.avatar_url ?? null
})

export const uploadCover = createAsyncThunk<
  string | null,
  { userId: string; file: ProfileImageUpload },
  ThunkConfig
>('profile/uploadCover', async ({ userId, file }, { rejectWithValue }) => {
  const response = await profileService.uploadImage(userId, file, 'cover')
  if (!response.success) return rejectWithValue(response.error ?? 'Upload failed.')
  return response.data?.cover_url ?? null
})

// ---- Experiences ----

export const addExperience = createAsyncThunk<
  ProfileExperience | null,
  { userId: string; experience: ExperienceInput },
  ThunkConfig
>('profile/addExperience', ({ userId, experience }, { rejectWithValue }) =>
  resolveResponse(
    profileService.addExperience(userId, experience),
    rejectWithValue,
  ) as Promise<ProfileExperience | null>,
)

export const updateExperience = createAsyncThunk<
  ProfileExperience | null,
  { experienceId: string; updates: Partial<ExperienceInput> },
  ThunkConfig
>('profile/updateExperience', ({ experienceId, updates }, { rejectWithValue }) =>
  resolveResponse(
    profileService.updateExperience(experienceId, updates),
    rejectWithValue,
  ) as Promise<ProfileExperience | null>,
)

export const deleteExperience = createAsyncThunk<string, string, ThunkConfig>(
  'profile/deleteExperience',
  async (experienceId, { rejectWithValue }) => {
    const response = await profileService.deleteExperience(experienceId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return experienceId
  },
)

// ---- Education ----

export const addEducation = createAsyncThunk<
  ProfileEducation | null,
  { userId: string; education: EducationInput },
  ThunkConfig
>('profile/addEducation', ({ userId, education }, { rejectWithValue }) =>
  resolveResponse(
    profileService.addEducation(userId, education),
    rejectWithValue,
  ) as Promise<ProfileEducation | null>,
)

export const updateEducation = createAsyncThunk<
  ProfileEducation | null,
  { educationId: string; updates: Partial<EducationInput> },
  ThunkConfig
>('profile/updateEducation', ({ educationId, updates }, { rejectWithValue }) =>
  resolveResponse(
    profileService.updateEducation(educationId, updates),
    rejectWithValue,
  ) as Promise<ProfileEducation | null>,
)

export const deleteEducation = createAsyncThunk<string, string, ThunkConfig>(
  'profile/deleteEducation',
  async (educationId, { rejectWithValue }) => {
    const response = await profileService.deleteEducation(educationId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return educationId
  },
)

// ---- Skills ----

export const addSkill = createAsyncThunk<
  ProfileSkill | null,
  { userId: string; skill: SkillInput },
  ThunkConfig
>('profile/addSkill', ({ userId, skill }, { rejectWithValue }) =>
  resolveResponse(profileService.addSkill(userId, skill), rejectWithValue) as Promise<
    ProfileSkill | null
  >,
)

export const deleteSkill = createAsyncThunk<string, string, ThunkConfig>(
  'profile/deleteSkill',
  async (skillId, { rejectWithValue }) => {
    const response = await profileService.deleteSkill(skillId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return skillId
  },
)

// ---- Connections & follows ----

export const loadConnections = createAsyncThunk<NetworkMember[], string, ThunkConfig>(
  'profile/loadConnections',
  async (userId, { rejectWithValue }) => {
    const response = await profileService.getConnections(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load connections.')
    return response.data ?? []
  },
)

export const followUser = createAsyncThunk<
  void,
  { senderId: string; receiverId: string },
  ThunkConfig
>('profile/followUser', async ({ senderId, receiverId }, { rejectWithValue, dispatch }) => {
  const response = await profileService.followUser(senderId, receiverId)
  if (!response.success) return rejectWithValue(response.error ?? 'Follow failed.') as never
  await dispatch(loadConnections(senderId))
})

export const unfollowUser = createAsyncThunk<
  void,
  { senderId: string; receiverId: string },
  ThunkConfig
>('profile/unfollowUser', async ({ senderId, receiverId }, { rejectWithValue, dispatch }) => {
  const response = await profileService.unfollowUser(senderId, receiverId)
  if (!response.success) return rejectWithValue(response.error ?? 'Unfollow failed.') as never
  await dispatch(loadConnections(senderId))
})

// ---- Discovery & search ----

export const loadAllProfiles = createAsyncThunk<
  { profiles: Profile[]; append: boolean },
  { excludeUserId?: string | null; filters?: ProfileDiscoveryFilters },
  ThunkConfig
>('profile/loadAllProfiles', async ({ excludeUserId = null, filters = {} }, { rejectWithValue }) => {
  const response = await profileService.getAllProfiles(excludeUserId, filters)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to load profiles.')
  return { profiles: response.data ?? [], append: (filters.page ?? 0) > 0 }
})

export const searchUsers = createAsyncThunk<
  ProfileSummary[],
  { query: string; filters?: ProfileSearchFilters },
  ThunkConfig
>('profile/searchUsers', async ({ query, filters = {} }, { rejectWithValue }) => {
  const response = await profileService.searchUsers(query, filters)
  if (!response.success) return rejectWithValue(response.error ?? 'Search failed.')
  return response.data ?? []
})

// ---- Verification ----

export const loadVerificationStatus = createAsyncThunk<
  ProfileState['verificationStatus'],
  string,
  ThunkConfig
>('profile/loadVerificationStatus', async (userId, { rejectWithValue }) => {
  const response = await profileService.checkVerificationStatus(userId)
  if (!response.success || !response.data) {
    return rejectWithValue(response.error ?? 'Failed to load verification status.')
  }
  return {
    isVerified: response.data.isVerified,
    needsVerification: response.data.needsVerification,
    attempts: response.data.verificationAttempts,
  }
})

export const updateVerificationStatus = createAsyncThunk<
  ProfileState['verificationStatus'],
  { userId: string; verificationData: VerificationUpdate },
  ThunkConfig
>('profile/updateVerificationStatus', async ({ userId, verificationData }, { rejectWithValue }) => {
  const response = await profileService.updateVerificationStatus(userId, verificationData)
  if (!response.success) return rejectWithValue(response.error ?? 'Update failed.')
  return {
    isVerified: verificationData.isVerified,
    needsVerification: !verificationData.isVerified,
    attempts: verificationData.attempts ?? 0,
  }
})

// ---- Completion score ----

export const loadCompletionScore = createAsyncThunk<number, string, ThunkConfig>(
  'profile/loadCompletionScore',
  async (userId, { rejectWithValue }) => {
    const response = await profileService.getProfileCompletionScore(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load score.')
    return response.data ?? 0
  },
)

// ---- Collections & saved posts ----

export const loadCollections = createAsyncThunk<Collection[], string, ThunkConfig>(
  'profile/loadCollections',
  async (userId, { rejectWithValue }) => {
    const response = await profileService.getCollections(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load collections.')
    return response.data ?? []
  },
)

export const createCollection = createAsyncThunk<
  Collection | null,
  { userId: string; name: string },
  ThunkConfig
>('profile/createCollection', ({ userId, name }, { rejectWithValue }) =>
  resolveResponse(profileService.createCollection(userId, name), rejectWithValue) as Promise<
    Collection | null
  >,
)

export const loadSavedPosts = createAsyncThunk<SavedPost[], string, ThunkConfig>(
  'profile/loadSavedPosts',
  async (userId, { rejectWithValue }) => {
    const response = await profileService.getSavedPosts(userId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to load saved posts.')
    return response.data ?? []
  },
)

export const savePost = createAsyncThunk<
  SavedPost[],
  { userId: string; postId: string; collectionNames?: string[] },
  ThunkConfig
>('profile/savePost', async ({ userId, postId, collectionNames = [] }, { rejectWithValue }) => {
  const response = await profileService.savePost(userId, postId, collectionNames)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to save post.')
  return response.data ?? []
})

// ---- Account lifecycle ----

export const recordProfileView = createAsyncThunk<
  void,
  { profileUserId: string; viewerUserId?: string | null }
>('profile/recordProfileView', async ({ profileUserId, viewerUserId = null }) => {
  await profileService.recordProfileView(profileUserId, viewerUserId)
})

export const createInitialProfile = createAsyncThunk<Profile | null, User, ThunkConfig>(
  'profile/createInitialProfile',
  (user, { rejectWithValue }) =>
    resolveResponse(profileService.createInitialProfile(user), rejectWithValue) as Promise<
      Profile | null
    >,
)

export const softDeleteProfile = createAsyncThunk<
  Profile | null,
  { userId: string; reason?: string },
  ThunkConfig
>('profile/softDeleteProfile', ({ userId, reason }, { rejectWithValue }) =>
  resolveResponse(profileService.softDeleteProfile(userId, reason), rejectWithValue) as Promise<
    Profile | null
  >,
)

export const cancelProfileDeletion = createAsyncThunk<Profile | null, string, ThunkConfig>(
  'profile/cancelProfileDeletion',
  (userId, { rejectWithValue }) =>
    resolveResponse(
      profileService.cancelProfileDeletion(userId),
      rejectWithValue,
    ) as Promise<Profile | null>,
)

export const blockUser = createAsyncThunk<
  void,
  { currentUserId: string; targetUserId: string },
  ThunkConfig
>('profile/blockUser', async ({ currentUserId, targetUserId }, { rejectWithValue }) => {
  const response = await profileService.blockUser(currentUserId, targetUserId)
  if (!response.success) return rejectWithValue(response.error ?? 'Block failed.') as never
})

// ============= OPTIMISTIC ROLLBACK REGISTRY =============
//
// Optimistic UI: mutations apply to state immediately on `pending`, reconcile
// with the authoritative server row on `fulfilled`, and revert on `rejected`.
// Snapshots needed for a revert are keyed by the thunk's `requestId` and kept
// OUTSIDE Redux state so the state stays fully serializable.

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

/** Deterministic temp id for an optimistically-inserted row. */
function optimisticId(requestId: string): string {
  return `temp-${requestId}`
}

const profileSlice = createSlice({
  name: 'profile',
  initialState: initialProfileState,
  reducers: {
    openEditModal: (
      state,
      action: PayloadAction<{ type: EditModalType; data?: unknown }>,
    ) => {
      state.showEditModal = true
      state.editModalType = action.payload.type
      state.editModalData = action.payload.data ?? null
    },
    closeEditModal: (state) => {
      state.showEditModal = false
      state.editModalType = null
      state.editModalData = null
    },
    setProfileError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearProfileError: (state) => {
      state.error = null
    },
    resetProfile: () => initialProfileState,
  },
  extraReducers: (builder) => {
    builder
      // loadProfile
      .addCase(loadProfile.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.profile = action.payload
        state.isLoading = false
      })
      .addCase(loadProfile.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load profile.'
        state.isLoading = false
      })

      // loadCompleteProfile
      .addCase(loadCompleteProfile.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadCompleteProfile.fulfilled, (state, action) => {
        const data = action.payload
        state.profile = data?.profile ?? null
        state.experiences = data?.experiences ?? []
        state.education = data?.education ?? []
        state.skills = data?.skills ?? []
        state.isLoading = false
      })
      .addCase(loadCompleteProfile.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load profile.'
        state.isLoading = false
      })

      // updateProfile / updateProfileBio — optimistic merge, revert on failure
      .addCase(updateProfile.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, state.profile ? current(state.profile) : null)
        if (state.profile) {
          state.profile = { ...state.profile, ...action.meta.arg.updates } as Profile
        }
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        if (action.payload) state.profile = { ...state.profile, ...action.payload } as Profile
        state.isSaving = false
      })
      .addCase(updateProfile.rejected, (state, action) => {
        const previous = takeRollback<Profile | null>(action.meta.requestId)
        if (previous !== undefined) state.profile = previous
        state.error = action.payload ?? 'Update failed.'
        state.isSaving = false
      })
      .addCase(updateProfileBio.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, state.profile ? current(state.profile) : null)
        if (state.profile) state.profile.bio = action.meta.arg.bio
      })
      .addCase(updateProfileBio.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        if (action.payload) state.profile = { ...state.profile, ...action.payload } as Profile
        state.isSaving = false
      })
      .addCase(updateProfileBio.rejected, (state, action) => {
        const previous = takeRollback<Profile | null>(action.meta.requestId)
        if (previous !== undefined) state.profile = previous
        state.error = action.payload ?? 'Update failed.'
        state.isSaving = false
      })

      // uploads — reconciled once the storage URL is known
      .addCase(uploadAvatar.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(uploadAvatar.fulfilled, (state, action) => {
        if (state.profile && action.payload) state.profile.avatar_url = action.payload
        state.isLoading = false
      })
      .addCase(uploadAvatar.rejected, (state, action) => {
        state.error = action.payload ?? 'Upload failed.'
        state.isLoading = false
      })
      .addCase(uploadCover.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(uploadCover.fulfilled, (state, action) => {
        if (state.profile && action.payload) state.profile.cover_url = action.payload
        state.isLoading = false
      })
      .addCase(uploadCover.rejected, (state, action) => {
        state.error = action.payload ?? 'Upload failed.'
        state.isLoading = false
      })

      // experiences — optimistic insert/update/delete
      .addCase(addExperience.pending, (state, action) => {
        state.error = null
        state.showEditModal = false
        state.experiences.unshift({
          id: optimisticId(action.meta.requestId),
          ...action.meta.arg.experience,
        } as ProfileExperience)
      })
      .addCase(addExperience.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.experiences = action.payload
          ? state.experiences.map((item) => (item.id === tempId ? action.payload! : item))
          : state.experiences.filter((item) => item.id !== tempId)
      })
      .addCase(addExperience.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.experiences = state.experiences.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add experience.'
      })
      .addCase(updateExperience.pending, (state, action) => {
        state.error = null
        state.showEditModal = false
        const index = state.experiences.findIndex((item) => item.id === action.meta.arg.experienceId)
        if (index >= 0) {
          stashRollback(action.meta.requestId, {
            index,
            item: current(state.experiences[index]),
          })
          state.experiences[index] = {
            ...state.experiences[index],
            ...action.meta.arg.updates,
          } as ProfileExperience
        }
      })
      .addCase(updateExperience.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        if (action.payload) {
          state.experiences = state.experiences.map((item) =>
            item.id === action.payload!.id ? action.payload! : item,
          )
        }
      })
      .addCase(updateExperience.rejected, (state, action) => {
        const snapshot = takeRollback<{ index: number; item: ProfileExperience }>(
          action.meta.requestId,
        )
        if (snapshot) state.experiences[snapshot.index] = snapshot.item
        state.error = action.payload ?? 'Failed to update experience.'
      })
      .addCase(deleteExperience.pending, (state, action) => {
        state.error = null
        const index = state.experiences.findIndex((item) => item.id === action.meta.arg)
        if (index >= 0) {
          stashRollback(action.meta.requestId, {
            index,
            item: current(state.experiences[index]),
          })
          state.experiences.splice(index, 1)
        }
      })
      .addCase(deleteExperience.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteExperience.rejected, (state, action) => {
        const snapshot = takeRollback<{ index: number; item: ProfileExperience }>(
          action.meta.requestId,
        )
        if (snapshot) state.experiences.splice(snapshot.index, 0, snapshot.item)
        state.error = action.payload ?? 'Failed to delete experience.'
      })

      // education — optimistic insert/update/delete
      .addCase(addEducation.pending, (state, action) => {
        state.error = null
        state.showEditModal = false
        state.education.unshift({
          id: optimisticId(action.meta.requestId),
          ...action.meta.arg.education,
        } as ProfileEducation)
      })
      .addCase(addEducation.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.education = action.payload
          ? state.education.map((item) => (item.id === tempId ? action.payload! : item))
          : state.education.filter((item) => item.id !== tempId)
      })
      .addCase(addEducation.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.education = state.education.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add education.'
      })
      .addCase(updateEducation.pending, (state, action) => {
        state.error = null
        state.showEditModal = false
        const index = state.education.findIndex((item) => item.id === action.meta.arg.educationId)
        if (index >= 0) {
          stashRollback(action.meta.requestId, {
            index,
            item: current(state.education[index]),
          })
          state.education[index] = {
            ...state.education[index],
            ...action.meta.arg.updates,
          } as ProfileEducation
        }
      })
      .addCase(updateEducation.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        if (action.payload) {
          state.education = state.education.map((item) =>
            item.id === action.payload!.id ? action.payload! : item,
          )
        }
      })
      .addCase(updateEducation.rejected, (state, action) => {
        const snapshot = takeRollback<{ index: number; item: ProfileEducation }>(
          action.meta.requestId,
        )
        if (snapshot) state.education[snapshot.index] = snapshot.item
        state.error = action.payload ?? 'Failed to update education.'
      })
      .addCase(deleteEducation.pending, (state, action) => {
        state.error = null
        const index = state.education.findIndex((item) => item.id === action.meta.arg)
        if (index >= 0) {
          stashRollback(action.meta.requestId, {
            index,
            item: current(state.education[index]),
          })
          state.education.splice(index, 1)
        }
      })
      .addCase(deleteEducation.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteEducation.rejected, (state, action) => {
        const snapshot = takeRollback<{ index: number; item: ProfileEducation }>(
          action.meta.requestId,
        )
        if (snapshot) state.education.splice(snapshot.index, 0, snapshot.item)
        state.error = action.payload ?? 'Failed to delete education.'
      })

      // skills — optimistic insert/delete
      .addCase(addSkill.pending, (state, action) => {
        state.error = null
        state.skills.push({
          id: optimisticId(action.meta.requestId),
          ...action.meta.arg.skill,
        } as ProfileSkill)
      })
      .addCase(addSkill.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.skills = action.payload
          ? state.skills.map((item) => (item.id === tempId ? action.payload! : item))
          : state.skills.filter((item) => item.id !== tempId)
      })
      .addCase(addSkill.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.skills = state.skills.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to add skill.'
      })
      .addCase(deleteSkill.pending, (state, action) => {
        state.error = null
        const index = state.skills.findIndex((item) => item.id === action.meta.arg)
        if (index >= 0) {
          stashRollback(action.meta.requestId, {
            index,
            item: current(state.skills[index]),
          })
          state.skills.splice(index, 1)
        }
      })
      .addCase(deleteSkill.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteSkill.rejected, (state, action) => {
        const snapshot = takeRollback<{ index: number; item: ProfileSkill }>(action.meta.requestId)
        if (snapshot) state.skills.splice(snapshot.index, 0, snapshot.item)
        state.error = action.payload ?? 'Failed to delete skill.'
      })

      // connections
      .addCase(loadConnections.fulfilled, (state, action) => {
        state.connections = action.payload
      })

      // discovery / search
      .addCase(loadAllProfiles.pending, (state, action) => {
        if (!((action.meta.arg.filters?.page ?? 0) > 0)) state.isLoading = true
        state.error = null
      })
      .addCase(loadAllProfiles.fulfilled, (state, action) => {
        state.allProfiles = action.payload.append
          ? [...state.allProfiles, ...action.payload.profiles]
          : action.payload.profiles
        state.isLoading = false
      })
      .addCase(loadAllProfiles.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load profiles.'
        state.isLoading = false
      })
      .addCase(searchUsers.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.searchResults = action.payload
        state.isLoading = false
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.error = action.payload ?? 'Search failed.'
        state.isLoading = false
      })

      // verification — optimistic status flip, revert on failure
      .addCase(loadVerificationStatus.fulfilled, (state, action) => {
        state.verificationStatus = action.payload
      })
      .addCase(updateVerificationStatus.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, current(state.verificationStatus))
        const { isVerified, attempts } = action.meta.arg.verificationData
        state.verificationStatus = {
          isVerified,
          needsVerification: !isVerified,
          attempts: attempts ?? state.verificationStatus.attempts,
        }
      })
      .addCase(updateVerificationStatus.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.verificationStatus = action.payload
      })
      .addCase(updateVerificationStatus.rejected, (state, action) => {
        const previous = takeRollback<ProfileState['verificationStatus']>(action.meta.requestId)
        if (previous) state.verificationStatus = previous
        state.error = action.payload ?? 'Failed to update verification.'
      })

      // completion score
      .addCase(loadCompletionScore.fulfilled, (state, action) => {
        state.completionScore = action.payload
      })

      // collections & saved posts — optimistic insert
      .addCase(loadCollections.fulfilled, (state, action) => {
        state.collections = action.payload
      })
      .addCase(createCollection.pending, (state, action) => {
        state.error = null
        state.collections.push({
          id: optimisticId(action.meta.requestId),
          name: action.meta.arg.name,
          user_id: action.meta.arg.userId,
          is_default: false,
          created_at: new Date().toISOString(),
        })
      })
      .addCase(createCollection.fulfilled, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.collections = action.payload
          ? state.collections.map((item) => (item.id === tempId ? action.payload! : item))
          : state.collections.filter((item) => item.id !== tempId)
      })
      .addCase(createCollection.rejected, (state, action) => {
        const tempId = optimisticId(action.meta.requestId)
        state.collections = state.collections.filter((item) => item.id !== tempId)
        state.error = action.payload ?? 'Failed to create collection.'
      })
      .addCase(loadSavedPosts.fulfilled, (state, action) => {
        state.savedPosts = action.payload
      })
      .addCase(savePost.pending, (state, action) => {
        state.error = null
        const base = optimisticId(action.meta.requestId)
        const names = action.meta.arg.collectionNames?.length
          ? action.meta.arg.collectionNames
          : [null]
        names.forEach((collectionName, index) => {
          state.savedPosts.push({
            id: `${base}-${index}`,
            user_id: action.meta.arg.userId,
            post_id: action.meta.arg.postId,
            collection_name: collectionName,
            notes: null,
            created_at: new Date().toISOString(),
          })
        })
      })
      .addCase(savePost.fulfilled, (state, action) => {
        const base = optimisticId(action.meta.requestId)
        state.savedPosts = state.savedPosts.filter((item) => !item.id.startsWith(base))
        state.savedPosts.push(...action.payload)
      })
      .addCase(savePost.rejected, (state, action) => {
        const base = optimisticId(action.meta.requestId)
        state.savedPosts = state.savedPosts.filter((item) => !item.id.startsWith(base))
        state.error = action.payload ?? 'Failed to save post.'
      })

      // lifecycle — optimistic account status flip, revert on failure
      .addCase(createInitialProfile.fulfilled, (state, action) => {
        state.profile = action.payload
      })
      .addCase(softDeleteProfile.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (state.profile) {
          stashRollback(action.meta.requestId, {
            is_active: state.profile.is_active,
            account_status: state.profile.account_status,
          })
          state.profile.is_active = false
          state.profile.account_status = 'inactive'
        }
      })
      .addCase(softDeleteProfile.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isLoading = false
      })
      .addCase(softDeleteProfile.rejected, (state, action) => {
        const previous = takeRollback<{ is_active: boolean; account_status: string }>(
          action.meta.requestId,
        )
        if (state.profile && previous) {
          state.profile.is_active = previous.is_active
          state.profile.account_status = previous.account_status
        }
        state.error = action.payload ?? 'Failed to delete profile.'
        state.isLoading = false
      })
      .addCase(cancelProfileDeletion.pending, (state, action) => {
        state.isLoading = true
        state.error = null
        if (state.profile) {
          stashRollback(action.meta.requestId, {
            is_active: state.profile.is_active,
            account_status: state.profile.account_status,
          })
          state.profile.is_active = true
          state.profile.account_status = 'active'
        }
      })
      .addCase(cancelProfileDeletion.fulfilled, (state, action) => {
        rollbackRegistry.delete(action.meta.requestId)
        state.isLoading = false
      })
      .addCase(cancelProfileDeletion.rejected, (state, action) => {
        const previous = takeRollback<{ is_active: boolean; account_status: string }>(
          action.meta.requestId,
        )
        if (state.profile && previous) {
          state.profile.is_active = previous.is_active
          state.profile.account_status = previous.account_status
        }
        state.error = action.payload ?? 'Failed to cancel deletion.'
        state.isLoading = false
      })
  },
})

export const {
  openEditModal,
  closeEditModal,
  setProfileError,
  clearProfileError,
  resetProfile,
} = profileSlice.actions

export const profileReducer = profileSlice.reducer

// ============= PROFILE COMPLETION SLICE =============

type ProfileCompletionState = {
  showBasicProfileModal: boolean
  isBasicProfileCompleted: boolean
  isBasicProfileSkipped: boolean
  isLoading: boolean
  error: string | null
  profileCompletionScore: number | null
}

const initialCompletionState: ProfileCompletionState = {
  showBasicProfileModal: false,
  isBasicProfileCompleted: false,
  isBasicProfileSkipped: false,
  isLoading: false,
  error: null,
  profileCompletionScore: null,
}

const profileCompletionSlice = createSlice({
  name: 'profileCompletion',
  initialState: initialCompletionState,
  reducers: {
    setShowBasicProfileModal: (state, action: PayloadAction<boolean>) => {
      state.showBasicProfileModal = action.payload
    },
    setBasicProfileCompleted: (state, action: PayloadAction<boolean>) => {
      state.isBasicProfileCompleted = action.payload
      state.showBasicProfileModal = false
    },
    setBasicProfileSkipped: (state, action: PayloadAction<boolean>) => {
      state.isBasicProfileSkipped = action.payload
      state.showBasicProfileModal = false
    },
    setCompletionLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setCompletionError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setProfileCompletionScore: (state, action: PayloadAction<number | null>) => {
      state.profileCompletionScore = action.payload
    },
    /** Evaluate whether the basic-profile modal should be shown for a profile. */
    evaluateBasicProfileModal: (
      state,
      action: PayloadAction<{
        profile: Partial<Profile> | null | undefined
        completionScore: number | null | undefined
      }>,
    ) => {
      const { show, resetStatus } = shouldShowBasicProfileModal({
        profile: action.payload.profile,
        completionScore: action.payload.completionScore,
        isBasicProfileCompleted: state.isBasicProfileCompleted,
        isBasicProfileSkipped: state.isBasicProfileSkipped,
      })

      if (resetStatus) {
        state.isBasicProfileCompleted = false
        state.isBasicProfileSkipped = false
      }
      state.showBasicProfileModal = show
    },
    resetCompletion: (state) => {
      state.showBasicProfileModal = false
      state.isLoading = false
      state.error = null
      state.profileCompletionScore = null
    },
    resetCompletionStatus: (state) => {
      state.isBasicProfileCompleted = false
      state.isBasicProfileSkipped = false
      state.showBasicProfileModal = false
    },
    forceShowModal: (state) => {
      state.isBasicProfileCompleted = false
      state.isBasicProfileSkipped = false
      state.showBasicProfileModal = true
    },
  },
})

export const {
  setShowBasicProfileModal,
  setBasicProfileCompleted,
  setBasicProfileSkipped,
  setCompletionLoading,
  setCompletionError,
  setProfileCompletionScore,
  evaluateBasicProfileModal,
  resetCompletion,
  resetCompletionStatus,
  forceShowModal,
} = profileCompletionSlice.actions

export const profileCompletionReducer = profileCompletionSlice.reducer
