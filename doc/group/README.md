# Community Groups Store — Developer Guide

Everything group-related for **admin** (and reusable by community) lives in
**`lib/group/`** and is exposed through the same **Redux Toolkit** store used by
shops, sale events, company pages, and CMS.

> **TL;DR** — Import from `~/lib/group`, read with `useAppSelector((s) => s.group.*)`,
> and mutate with `dispatch(thunk(args))`. Create / update / delete are **optimistic**
> and roll back on failure. Errors are always friendly via `group.errors`.

This module ports admin CRUD patterns against the `public.groups` schema (plus
members, join requests, invitations, and group posts).

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/group/group.type.ts` | Types + constants (`Group`, `GroupWithCounts`, group types, storage bucket) |
| `lib/group/group.errors.ts` | `GroupError`, `GROUP_ERROR_CODES`, `classifyGroupError`, `toFriendlyGroupError` |
| `lib/group/group.validation.ts` | Zod schemas (`createGroupSchema`, `updateGroupSchema`, …) + `parseOrThrow` / `validate` |
| `lib/group/group.utils.ts` | Name helpers, display labels, image validation |
| `lib/group/group.service.ts` | Typed Supabase data-access. Prefer thunks from UI. |
| `lib/group/group.store.ts` | Redux slice, async thunks, sync actions — **main entry for admin UI** |
| `lib/group/index.ts` | Barrel — `import { … } from '~/lib/group'` |

Slice key: **`state.group`** (registered in `lib/store/index.ts`, not persisted).

### Schema (source of truth)

```sql
groups (
  id uuid PK default gen_random_uuid(),
  name varchar(100) not null,
  description text null,
  avatar_url text null,
  cover_url text null,
  title varchar(255) not null,
  members_count integer null default 0,
  industries text[] null,
  location varchar(100) null,
  rules text null,
  group_type varchar(20) null default 'public',
  allow_invites boolean null default true,
  require_post_review boolean null default false,
  created_by uuid null → profiles(id) on delete set null,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  raw_group_data jsonb null
)

-- index: idx_groups_raw_group_data_id on (raw_group_data->>'id')
```

On create, the service inserts the creator as an `admin` row in `group_members`
and sets `members_count` to `1`.

### Related tables

| Table / RPC | Role |
|-------------|------|
| `group_members` | Membership (`admin` / `member`, status `active`) |
| `group_join_requests` | Private-group join queue |
| `group_invitations` | Invite graph |
| `posts.group_id` | Group feed posts |
| RPC `community_group_facets` | Filter facet values |
| RPC `set_community_group_member_role` | Promote / demote |
| RPC `increment_members_count` / `decrement_members_count` | Counter helpers |
| Storage `post-images` | Avatar / cover (`…/community-groups/group-avatars|group-covers/…`) |

### Existing community code (do not delete yet)

`community/lib/groups.ts` still powers the public community screens. When you
build the admin UI, use **`~/lib/group`**. A later cleanup can point community
screens at the same service layer.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadGroups,
  loadGroupPlatformStats,
  createGroup,
} from '~/lib/group'

export function AdminGroups() {
  const dispatch = useAppDispatch()
  const groups = useAppSelector((s) => s.group.groups)
  const isLoading = useAppSelector((s) => s.group.isLoadingList)

  useEffect(() => {
    dispatch(loadGroups({ limit: 20, offset: 0 }))
    dispatch(loadGroupPlatformStats())
  }, [dispatch])

  async function onCreate(formData: unknown) {
    try {
      await dispatch(createGroup(formData)).unwrap()
    } catch (message) {
      console.error(String(message))
    }
  }

  // render groups…
}
```

---

## 3. State shape

`useAppSelector((s) => s.group.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `groups` | `GroupWithCounts[]` | Admin list (member/post/pending counts + creator) |
| `totalGroups` | `number` | Total matching rows (for pagination) |
| `hasMore` | `boolean` | More pages available |
| `currentGroup` | `GroupDetail \| null` | Open detail (members, requests, invitations, engagement) |
| `facets` | `GroupFacets \| null` | Filter option lists |
| `platformStats` | `GroupPlatformStats \| null` | Dashboard totals |
| `error` | `string \| null` | Last **friendly** error |
| `successMessage` | `string \| null` | Last success message |
| `isLoadingList` / `isLoadingDetail` / `isSaving` / `isDeleting` / … | `boolean` | In-flight flags |

---

## 4. How optimistic UI works

| Thunk | Optimistic behaviour |
|-------|----------------------|
| `createGroup` | Prepends temp `optimistic-…` row; swaps on success; removes on failure |
| `updateGroup` | Merges patch into list + detail; rolls back on failure |
| `deleteGroup` / `deleteGroupsBatch` | Removes row(s) immediately; restores on failure |
| `removeGroupMember` | Removes member from `currentGroup.members`; restores on failure |

**Rule:** dispatch and render from state — no manual list mutation after a write.

---

## 5. Async thunks (dispatch these)

All imported from `~/lib/group`.

### Admin — groups

| Thunk | Arg | Does |
|-------|-----|------|
| `loadGroups` | `{ filters?, limit?, offset?, orderBy?, ascending? }` | List → `groups` (`offset > 0` appends) |
| `loadGroupDetail` | `id` | Full detail → `currentGroup` |
| `createGroup` | form payload | Validates + creates (optimistic) |
| `updateGroup` | `{ groupId, payload }` | Validates + updates (optimistic) |
| `deleteGroup` | `groupId` | Deletes (optimistic) |
| `deleteGroupsBatch` | `groupId[]` | Batch delete (optimistic) |
| `reassignGroupOwner` | `{ groupId, newOwnerId }` | Updates `created_by` + ensures admin member |

### Admin — members / join requests

| Thunk | Arg | Does |
|-------|-----|------|
| `setGroupMemberRole` | `{ groupId, userId, role: 'admin' \| 'member' }` | RPC `set_community_group_member_role` |
| `removeGroupMember` | `{ groupId, userId }` | Removes membership (not creator) |
| `respondToGroupJoinRequest` | `{ groupId, requestId, approve }` | Approve / reject pending request |

### Admin — pickers / dashboard

| Thunk | Arg | Does |
|-------|-----|------|
| `loadGroupFacets` | — | Locations / industries / group types |
| `loadGroupPlatformStats` | — | Totals for admin header cards |

---

## 6. Service functions (when you need them outside Redux)

Prefer thunks. Call these only for uploads (Blobs must not enter Redux) or one-off scripts.

### CRUD

| Function | Purpose |
|----------|---------|
| `listGroups` | Paginated filtered list + counts |
| `getGroupById` | Single group + counts |
| `getGroupByRawIdOrUuid` | Resolve uuid **or** `raw_group_data.id` |
| `getGroupDetail` | Group + members + requests + invitations + engagement |
| `createGroup` | Insert + creator as admin member |
| `updateGroup` | Partial update |
| `deleteGroup` | Hard delete |
| `deleteGroups` | Batch delete by ids |
| `deleteGroupsByCreator` | Delete all groups for a profile |
| `reassignGroupOwner` | Transfer `created_by` |

### Members / requests / invitations / engagement

| Function | Purpose |
|----------|---------|
| `getGroupMembers` | Active members with profile fields |
| `setGroupMemberRole` | RPC promote/demote |
| `removeGroupMember` | Remove non-creator member |
| `getGroupJoinRequests` | Pending (or filtered) requests |
| `respondToGroupJoinRequest` | Approve / reject (admin) |
| `getGroupInvitations` | Recent invitations with invitee profiles |
| `getGroupPostCount` | Non-deleted posts |
| `getGroupEngagementStats` | Aggregated `posts_with_stats` |

### Media

| Function | Purpose |
|----------|---------|
| `uploadGroupAvatar` / `deleteGroupAvatar` | `post-images` bucket |
| `uploadGroupCover` / `deleteGroupCover` | `post-images` bucket |
| `validateGroupImageFile` (utils) | Type + size check before upload |

### Facets / stats

| Function | Purpose |
|----------|---------|
| `getGroupFacets` | Filter menus |
| `getGroupPlatformStats` | Admin dashboard cards |

### Upload recipe (avatar / cover)

```tsx
import {
  uploadGroupAvatar,
  deleteGroupAvatar,
  validateGroupImageFile,
  updateGroup,
} from '~/lib/group'
import { pickedImageToBlob } from '~/lib/media/pick-image'

const blob = await pickedImageToBlob(picked)
const file = {
  blob,
  mimeType: picked.mimeType || 'image/jpeg',
  fileName: picked.fileName || 'avatar.jpg',
  fileSize: picked.file?.size ?? blob.size,
}

const check = validateGroupImageFile(file)
if (!check.valid) return toast.show(check.error!, { tone: 'danger' })

const res = await uploadGroupAvatar(file, groupId)
if (!res.success) return toast.show(res.error!, { tone: 'danger' })

await dispatch(
  updateGroup({ groupId, payload: { avatar_url: res.data!.url } }),
).unwrap()

// optional: deleteGroupAvatar(oldUrl) when replacing
```

Use Tamagui `Image` with **`src={url}`** (not `source={{ uri }}`) so avatars/covers
render on web.

---

## 7. Sync actions

| Action | Does |
|--------|------|
| `setCurrentGroup` | Set open detail |
| `clearCurrentGroup` | Clear detail |
| `clearGroupMessages` | Clear `error` + `successMessage` |
| `setGroupError` | Set error banner manually |
| `resetGroup` | Reset slice (e.g. sign-out) |

---

## 8. Errors & toasts

```tsx
import { useAppToast } from '~/components/ui'
import { deleteGroup } from '~/lib/group'

const toast = useAppToast()

try {
  await dispatch(deleteGroup(id)).unwrap()
  toast.show('Group deleted', { tone: 'success' })
} catch (message) {
  toast.show('Couldn’t delete group', { tone: 'danger', message: String(message) })
}
```

Known codes: `NOT_AUTHENTICATED`, `NOT_FOUND`, `PERMISSION_DENIED`, `NAME_TAKEN`,
`DUPLICATE`, `INVALID_INPUT`, `NETWORK`, `UNKNOWN`.

---

## 9. Validation (Zod)

```tsx
import { validate, createGroupSchema } from '~/lib/group'

const { success, data, errors } = validate(createGroupSchema, formData)
if (!success) return toast.show(errors![0], { tone: 'danger' })
```

**Required on create:** `name`, `title`.

Optional: `description`, `avatar_url`, `cover_url`, `members_count`, `industries`
(string or `string[]`), `location`, `rules`, `group_type` (default `"public"`),
`allow_invites`, `require_post_review`, `created_by`, `raw_group_data`.

Suggested UI constants (also exported):

- `GROUP_TYPES` / `GROUP_TYPE_OPTIONS` — `public`, `private`, `secret`
- `GROUP_MEMBER_ROLES` — `admin`, `member`
- `GROUP_MEDIA_BUCKET` — `post-images`

### List filters

```ts
{
  filters?: {
    search?: string
    group_type?: string
    location?: string
    industry?: string       // matches industries[] contains
    created_by?: string     // uuid
  }
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'updated_at' | 'members_count' | 'name' | 'title'
  ascending?: boolean
}
```

---

## 10. Platform stats shape

```ts
{
  totalGroups: number
  publicGroups: number
  privateGroups: number
  groupsThisMonth: number
  totalMembers: number
  pendingJoinRequests: number
}
```

---

## 11. Admin UI wiring (next step)

When building `app/admin/groups.tsx` / `AdminGroupsManager`:

1. Dispatch `loadGroups` + `loadGroupPlatformStats` (+ `loadGroupFacets` for filters).
2. Detail drawer: `loadGroupDetail(id)`.
3. Form create/edit: `createGroup` / `updateGroup` with Zod-validated payloads.
4. Media: upload via service helpers, then patch `avatar_url` / `cover_url`.
5. Members tab: `setGroupMemberRole` / `removeGroupMember`.
6. Requests tab: `respondToGroupJoinRequest`.
