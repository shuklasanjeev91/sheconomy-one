/**
 * Redux Toolkit slice for Community Groups (admin-first).
 *
 * Async work lives in createAsyncThunks wrapping group.service.
 * Create / update / delete apply optimistically and roll back on failure.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as groupService from '~/lib/group/group.service'
import {
  DEFAULT_GROUP_LIMIT,
  type Group,
  type GroupDetail,
  type GroupFacets,
  type GroupListParams,
  type GroupPlatformStats,
  type GroupServiceResponse,
  type GroupWithCounts,
} from '~/lib/group/group.type'
import {
  createGroupSchema,
  parseOrThrow,
  respondJoinRequestSchema,
  setGroupMemberRoleSchema,
  updateGroupSchema,
} from '~/lib/group/group.validation'

// ============= STATE =============

type GroupState = {
  groups: GroupWithCounts[]
  totalGroups: number
  hasMore: boolean
  currentGroup: GroupDetail | null
  facets: GroupFacets | null
  platformStats: GroupPlatformStats | null

  error: string | null
  successMessage: string | null

  isLoadingList: boolean
  isLoadingDetail: boolean
  isSaving: boolean
  isDeleting: boolean
  isLoadingFacets: boolean
  isLoadingStats: boolean
  isUpdatingMember: boolean
  isRespondingJoinRequest: boolean
}

const initialState: GroupState = {
  groups: [],
  totalGroups: 0,
  hasMore: false,
  currentGroup: null,
  facets: null,
  platformStats: null,

  error: null,
  successMessage: null,

  isLoadingList: false,
  isLoadingDetail: false,
  isSaving: false,
  isDeleting: false,
  isLoadingFacets: false,
  isLoadingStats: false,
  isUpdatingMember: false,
  isRespondingJoinRequest: false,
}

// ============= ROLLBACK REGISTRY =============

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

function tempId(requestId: string): string {
  return `optimistic-${requestId}`
}

// ============= THUNK PLUMBING =============

type ThunkConfig = {
  rejectValue: string
  dispatch: AppDispatch
  state: { group: GroupState }
}

async function resolve<T>(
  promise: Promise<GroupServiceResponse<T>>,
  rejectWithValue: (value: string) => unknown,
): Promise<{ data: T; meta?: GroupServiceResponse<T>['meta'] }> {
  const response = await promise
  if (!response.success || response.data === null) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return { data: response.data, meta: response.meta }
}

// ============= THUNKS =============

export const loadGroups = createAsyncThunk<
  { items: GroupWithCounts[]; total: number; hasMore: boolean; append: boolean },
  GroupListParams | undefined,
  ThunkConfig
>('group/loadGroups', async (params = {}, { rejectWithValue }) => {
  const limit = params.limit ?? DEFAULT_GROUP_LIMIT
  const offset = params.offset ?? 0
  const { data, meta } = await resolve(
    groupService.listGroups({ ...params, limit, offset }),
    rejectWithValue,
  )
  return {
    items: data,
    total: meta?.total ?? data.length,
    hasMore: meta?.hasMore ?? false,
    append: offset > 0,
  }
})

export const loadGroupDetail = createAsyncThunk<GroupDetail, string, ThunkConfig>(
  'group/loadGroupDetail',
  async (id, { rejectWithValue }) =>
    (await resolve(groupService.getGroupDetail(id), rejectWithValue)).data,
)

export const createGroup = createAsyncThunk<GroupWithCounts, unknown, ThunkConfig>(
  'group/createGroup',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createGroupSchema, payload)
      const { data } = await resolve(groupService.createGroup(validated), rejectWithValue)
      return {
        ...data,
        member_count: 1,
        post_count: 0,
        pending_request_count: 0,
        creator: null,
      }
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateGroup = createAsyncThunk<
  GroupWithCounts,
  { groupId: string; payload: unknown },
  ThunkConfig
>('group/updateGroup', async ({ groupId, payload }, { getState, rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateGroupSchema, payload)
    const { data } = await resolve(groupService.updateGroup(groupId, validated), rejectWithValue)
    const existing = getState().group.groups.find((g) => g.id === groupId)
    return {
      ...data,
      member_count: existing?.member_count ?? data.members_count ?? 0,
      post_count: existing?.post_count ?? 0,
      pending_request_count: existing?.pending_request_count ?? 0,
      creator: existing?.creator ?? null,
    }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteGroup = createAsyncThunk<string, string, ThunkConfig>(
  'group/deleteGroup',
  async (groupId, { rejectWithValue }) => {
    const response = await groupService.deleteGroup(groupId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return groupId
  },
)

export const deleteGroupsBatch = createAsyncThunk<string[], string[], ThunkConfig>(
  'group/deleteGroupsBatch',
  async (groupIds, { rejectWithValue }) => {
    const response = await groupService.deleteGroups(groupIds)
    if (!response.success) return rejectWithValue(response.error ?? 'Batch delete failed.')
    return groupIds
  },
)

export const reassignGroupOwner = createAsyncThunk<
  Group,
  { groupId: string; newOwnerId: string },
  ThunkConfig
>('group/reassignGroupOwner', async ({ groupId, newOwnerId }, { rejectWithValue }) => {
  const { data } = await resolve(
    groupService.reassignGroupOwner(groupId, newOwnerId),
    rejectWithValue,
  )
  return data
})

export const setGroupMemberRole = createAsyncThunk<
  { group_id: string; user_id: string; role: string },
  { groupId: string; userId: string; role: 'admin' | 'member' },
  ThunkConfig
>('group/setGroupMemberRole', async ({ groupId, userId, role }, { rejectWithValue }) => {
  try {
    parseOrThrow(setGroupMemberRoleSchema, {
      group_id: groupId,
      user_id: userId,
      role,
    })
    const { data } = await resolve(
      groupService.setGroupMemberRole(groupId, userId, role),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to update member role.')
  }
})

export const removeGroupMember = createAsyncThunk<
  { groupId: string; userId: string },
  { groupId: string; userId: string },
  ThunkConfig
>('group/removeGroupMember', async ({ groupId, userId }, { rejectWithValue }) => {
  const response = await groupService.removeGroupMember(groupId, userId)
  if (!response.success) return rejectWithValue(response.error ?? 'Failed to remove member.')
  return { groupId, userId }
})

export const respondToGroupJoinRequest = createAsyncThunk<
  { groupId: string; requestId: string; status: string; user_id: string },
  { groupId: string; requestId: string; approve: boolean },
  ThunkConfig
>(
  'group/respondToGroupJoinRequest',
  async ({ groupId, requestId, approve }, { rejectWithValue }) => {
    try {
      parseOrThrow(respondJoinRequestSchema, {
        request_id: requestId,
        group_id: groupId,
        approve,
      })
      const { data } = await resolve(
        groupService.respondToGroupJoinRequest(requestId, groupId, approve),
        rejectWithValue,
      )
      return { groupId, requestId, status: data.status, user_id: data.user_id }
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to respond to request.')
    }
  },
)

export const loadGroupFacets = createAsyncThunk<GroupFacets, void, ThunkConfig>(
  'group/loadGroupFacets',
  async (_, { rejectWithValue }) =>
    (await resolve(groupService.getGroupFacets(), rejectWithValue)).data,
)

export const loadGroupPlatformStats = createAsyncThunk<GroupPlatformStats, void, ThunkConfig>(
  'group/loadGroupPlatformStats',
  async (_, { rejectWithValue }) =>
    (await resolve(groupService.getGroupPlatformStats(), rejectWithValue)).data,
)

// ============= SLICE =============

const groupSlice = createSlice({
  name: 'group',
  initialState,
  reducers: {
    setCurrentGroup(state, action: PayloadAction<GroupDetail | null>) {
      state.currentGroup = action.payload
    },
    clearCurrentGroup(state) {
      state.currentGroup = null
    },
    clearGroupMessages(state) {
      state.error = null
      state.successMessage = null
    },
    setGroupError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    resetGroup() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- list ----
      .addCase(loadGroups.pending, (state) => {
        state.isLoadingList = true
        state.error = null
      })
      .addCase(loadGroups.fulfilled, (state, action) => {
        state.isLoadingList = false
        state.groups = action.payload.append
          ? [...state.groups, ...action.payload.items]
          : action.payload.items
        state.totalGroups = action.payload.total
        state.hasMore = action.payload.hasMore
      })
      .addCase(loadGroups.rejected, (state, action) => {
        state.isLoadingList = false
        state.error = action.payload ?? 'Failed to load groups.'
      })

      // ---- detail ----
      .addCase(loadGroupDetail.pending, (state) => {
        state.isLoadingDetail = true
        state.error = null
      })
      .addCase(loadGroupDetail.fulfilled, (state, action) => {
        state.isLoadingDetail = false
        state.currentGroup = action.payload
      })
      .addCase(loadGroupDetail.rejected, (state, action) => {
        state.isLoadingDetail = false
        state.error = action.payload ?? 'Failed to load group.'
      })

      // ---- create (optimistic) ----
      .addCase(createGroup.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        const arg = action.meta.arg as Record<string, unknown>
        state.groups.unshift({
          ...(arg as unknown as Group),
          id: tempId(action.meta.requestId),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          members_count: 1,
          member_count: 1,
          post_count: 0,
          pending_request_count: 0,
          creator: null,
        } as GroupWithCounts)
        state.totalGroups += 1
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.isSaving = false
        state.successMessage = 'Group created'
        const temp = tempId(action.meta.requestId)
        const idx = state.groups.findIndex((g) => g.id === temp)
        if (idx >= 0) state.groups[idx] = action.payload
        else state.groups.unshift(action.payload)
      })
      .addCase(createGroup.rejected, (state, action) => {
        state.isSaving = false
        state.error = action.payload ?? 'Failed to create group.'
        const temp = tempId(action.meta.requestId)
        state.groups = state.groups.filter((g) => g.id !== temp)
        state.totalGroups = Math.max(0, state.totalGroups - 1)
      })

      // ---- update (optimistic) ----
      .addCase(updateGroup.pending, (state, action) => {
        state.isSaving = true
        state.error = null
        stashRollback(action.meta.requestId, {
          groups: state.groups,
          currentGroup: state.currentGroup,
        })
        const patch = action.meta.arg.payload as Record<string, unknown>
        state.groups = state.groups.map((g) =>
          g.id === action.meta.arg.groupId ? { ...g, ...patch } : g,
        )
        if (state.currentGroup?.id === action.meta.arg.groupId) {
          state.currentGroup = { ...state.currentGroup, ...patch }
        }
      })
      .addCase(updateGroup.fulfilled, (state, action) => {
        state.isSaving = false
        state.successMessage = 'Group updated'
        rollbackRegistry.delete(action.meta.requestId)
        state.groups = state.groups.map((g) =>
          g.id === action.payload.id ? action.payload : g,
        )
        if (state.currentGroup?.id === action.payload.id) {
          state.currentGroup = { ...state.currentGroup, ...action.payload }
        }
      })
      .addCase(updateGroup.rejected, (state, action) => {
        state.isSaving = false
        state.error = action.payload ?? 'Failed to update group.'
        const snap = takeRollback<{
          groups: GroupWithCounts[]
          currentGroup: GroupDetail | null
        }>(action.meta.requestId)
        if (snap) {
          state.groups = snap.groups
          state.currentGroup = snap.currentGroup
        }
      })

      // ---- delete (optimistic) ----
      .addCase(deleteGroup.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, {
          groups: state.groups,
          currentGroup: state.currentGroup,
          totalGroups: state.totalGroups,
        })
        state.groups = state.groups.filter((g) => g.id !== action.meta.arg)
        state.totalGroups = Math.max(0, state.totalGroups - 1)
        if (state.currentGroup?.id === action.meta.arg) state.currentGroup = null
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.isDeleting = false
        state.successMessage = 'Group deleted'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteGroup.rejected, (state, action) => {
        state.isDeleting = false
        state.error = action.payload ?? 'Failed to delete group.'
        const snap = takeRollback<{
          groups: GroupWithCounts[]
          currentGroup: GroupDetail | null
          totalGroups: number
        }>(action.meta.requestId)
        if (snap) {
          state.groups = snap.groups
          state.currentGroup = snap.currentGroup
          state.totalGroups = snap.totalGroups
        }
      })

      // ---- batch delete ----
      .addCase(deleteGroupsBatch.pending, (state, action) => {
        state.isDeleting = true
        state.error = null
        stashRollback(action.meta.requestId, {
          groups: state.groups,
          currentGroup: state.currentGroup,
          totalGroups: state.totalGroups,
        })
        const ids = new Set(action.meta.arg)
        state.groups = state.groups.filter((g) => !ids.has(g.id))
        state.totalGroups = Math.max(0, state.totalGroups - ids.size)
        if (state.currentGroup && ids.has(state.currentGroup.id)) state.currentGroup = null
      })
      .addCase(deleteGroupsBatch.fulfilled, (state, action) => {
        state.isDeleting = false
        state.successMessage = `${action.payload.length} group(s) deleted`
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteGroupsBatch.rejected, (state, action) => {
        state.isDeleting = false
        state.error = action.payload ?? 'Failed to delete groups.'
        const snap = takeRollback<{
          groups: GroupWithCounts[]
          currentGroup: GroupDetail | null
          totalGroups: number
        }>(action.meta.requestId)
        if (snap) {
          state.groups = snap.groups
          state.currentGroup = snap.currentGroup
          state.totalGroups = snap.totalGroups
        }
      })

      // ---- reassign owner ----
      .addCase(reassignGroupOwner.fulfilled, (state, action) => {
        state.successMessage = 'Owner reassigned'
        state.groups = state.groups.map((g) =>
          g.id === action.payload.id ? { ...g, created_by: action.payload.created_by } : g,
        )
        if (state.currentGroup?.id === action.payload.id) {
          state.currentGroup = { ...state.currentGroup, created_by: action.payload.created_by }
        }
      })
      .addCase(reassignGroupOwner.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to reassign owner.'
      })

      // ---- members ----
      .addCase(setGroupMemberRole.pending, (state) => {
        state.isUpdatingMember = true
        state.error = null
      })
      .addCase(setGroupMemberRole.fulfilled, (state, action) => {
        state.isUpdatingMember = false
        state.successMessage = `Member role set to ${action.payload.role}`
        if (state.currentGroup?.id === action.payload.group_id) {
          state.currentGroup.members = state.currentGroup.members.map((m) =>
            m.user_id === action.payload.user_id
              ? { ...m, role: action.payload.role as typeof m.role }
              : m,
          )
        }
      })
      .addCase(setGroupMemberRole.rejected, (state, action) => {
        state.isUpdatingMember = false
        state.error = action.payload ?? 'Failed to update member role.'
      })

      .addCase(removeGroupMember.pending, (state, action) => {
        state.isUpdatingMember = true
        state.error = null
        stashRollback(action.meta.requestId, {
          members: state.currentGroup?.members ?? [],
          member_count: state.currentGroup?.member_count ?? 0,
        })
        if (state.currentGroup?.id === action.meta.arg.groupId) {
          state.currentGroup.members = state.currentGroup.members.filter(
            (m) => m.user_id !== action.meta.arg.userId,
          )
          state.currentGroup.member_count = Math.max(0, state.currentGroup.member_count - 1)
        }
      })
      .addCase(removeGroupMember.fulfilled, (state, action) => {
        state.isUpdatingMember = false
        state.successMessage = 'Member removed'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(removeGroupMember.rejected, (state, action) => {
        state.isUpdatingMember = false
        state.error = action.payload ?? 'Failed to remove member.'
        const snap = takeRollback<{
          members: GroupDetail['members']
          member_count: number
        }>(action.meta.requestId)
        if (snap && state.currentGroup) {
          state.currentGroup.members = snap.members
          state.currentGroup.member_count = snap.member_count
        }
      })

      // ---- join requests ----
      .addCase(respondToGroupJoinRequest.pending, (state) => {
        state.isRespondingJoinRequest = true
        state.error = null
      })
      .addCase(respondToGroupJoinRequest.fulfilled, (state, action) => {
        state.isRespondingJoinRequest = false
        state.successMessage =
          action.payload.status === 'approved' ? 'Join request approved' : 'Join request rejected'
        if (state.currentGroup?.id === action.payload.groupId) {
          state.currentGroup.join_requests = state.currentGroup.join_requests.filter(
            (r) => r.id !== action.payload.requestId,
          )
          state.currentGroup.pending_request_count = Math.max(
            0,
            state.currentGroup.pending_request_count - 1,
          )
          if (action.payload.status === 'approved') {
            state.currentGroup.member_count += 1
          }
        }
      })
      .addCase(respondToGroupJoinRequest.rejected, (state, action) => {
        state.isRespondingJoinRequest = false
        state.error = action.payload ?? 'Failed to respond to join request.'
      })

      // ---- facets / stats ----
      .addCase(loadGroupFacets.pending, (state) => {
        state.isLoadingFacets = true
      })
      .addCase(loadGroupFacets.fulfilled, (state, action) => {
        state.isLoadingFacets = false
        state.facets = action.payload
      })
      .addCase(loadGroupFacets.rejected, (state, action) => {
        state.isLoadingFacets = false
        state.error = action.payload ?? 'Failed to load facets.'
      })

      .addCase(loadGroupPlatformStats.pending, (state) => {
        state.isLoadingStats = true
      })
      .addCase(loadGroupPlatformStats.fulfilled, (state, action) => {
        state.isLoadingStats = false
        state.platformStats = action.payload
      })
      .addCase(loadGroupPlatformStats.rejected, (state, action) => {
        state.isLoadingStats = false
        state.error = action.payload ?? 'Failed to load stats.'
      })
  },
})

export const {
  setCurrentGroup,
  clearCurrentGroup,
  clearGroupMessages,
  setGroupError,
  resetGroup,
} = groupSlice.actions

export const groupReducer = groupSlice.reducer
