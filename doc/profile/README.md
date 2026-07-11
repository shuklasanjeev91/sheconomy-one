# Profile Store — Developer Guide

Everything profile-related lives in **`lib/profile/`** and is exposed through a
**Redux Toolkit** store. This guide is for UI developers who want to read profile
state and dispatch profile actions from screens/components.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Mutations update the UI
> **optimistically** (instantly) and roll back automatically if the server
> rejects them.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/profile/profile.type.ts` | All TypeScript types + constants (`Profile`, `ProfileUpdate`, `USER_ROLES`, `PROFILE_COMPLETION`, …) |
| `lib/profile/profile.service.ts` | Typed Supabase data-access functions (network layer). You normally do **not** call these directly from UI — dispatch thunks instead. |
| `lib/profile/profile.store.ts` | Redux slices, async thunks, and sync actions. **This is your main entry point.** |
| `lib/profile/profile.utils.ts` | Pure helpers (`debounce`, `throttle`, `hasProfileChanged`, `getChangedFields`, `isBasicProfileComplete`, …) |
| `lib/profile/profile.validation.ts` | Field validators + `validateProfileData` (works with `useFormValidation`) |
| `lib/store/index.ts` | Root store (`store`, `RootState`, `AppDispatch`) |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`** |

The Redux `<Provider>` is already wired at the app root (`app/_layout.tsx`), so
there is nothing to set up — just use the hooks.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadCompleteProfile, updateProfile } from '~/lib/profile/profile.store'

export function MyProfileScreen({ userId }: { userId: string }) {
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.profile.profile)
  const isLoading = useAppSelector((s) => s.profile.isLoading)

  useEffect(() => {
    dispatch(loadCompleteProfile(userId))
  }, [dispatch, userId])

  if (isLoading) return <Spinner />

  return (
    <Button onPress={() => dispatch(updateProfile({ userId, updates: { bio: 'Hi!' } }))}>
      Save bio
    </Button>
  )
}
```

That `updateProfile` call updates the visible bio **immediately**; if the API
call fails, the old bio is restored and `state.profile.error` is set.

---

## 3. State shape

`useAppSelector((s) => s.profile.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `profile` | `Profile \| null` | The currently loaded profile row |
| `experiences` | `ProfileExperience[]` | Work experience list |
| `education` | `ProfileEducation[]` | Education list |
| `skills` | `ProfileSkill[]` | Skills list |
| `connections` | `NetworkMember[]` | Accepted connections |
| `allProfiles` | `Profile[]` | Discovery/browse results (paginated) |
| `searchResults` | `ProfileSummary[]` | Search results |
| `collections` | `Collection[]` | Saved-post collections |
| `savedPosts` | `SavedPost[]` | Saved posts |
| `isLoading` | `boolean` | A read/fetch is in flight |
| `isSaving` | `boolean` | A profile write is in flight |
| `error` | `string \| null` | Last error message (cleared on next action start) |
| `showEditModal` / `editModalType` / `editModalData` | modal UI state | Drives edit modals |
| `verificationStatus` | `{ isVerified; needsVerification; attempts }` | Gender/identity verification |
| `completionScore` | `number` | Profile completion percentage |

Completion-modal state lives in a **separate slice**: `s.profileCompletion.*`
(see section 7).

---

## 4. How optimistic UI works (important)

Every **mutation** thunk follows the same three-phase lifecycle:

1. **`pending`** → the change is applied to Redux state **right away** so the UI
   updates instantly (no spinner wait). For inserts, a temporary row with a
   `temp-…` id is added.
2. **`fulfilled`** → the optimistic value is reconciled with the **authoritative
   server row** (e.g. the temp row is swapped for the real one with its real id).
3. **`rejected`** → the change is **rolled back** to the previous state and
   `error` is set.

Snapshots used for rollback are kept outside Redux state (keyed by the thunk's
`requestId`), so state stays serializable.

**What this means for you:** just dispatch the action and render from state. You
don't need to manually add/remove items or refetch after a mutation. If you want
to show a toast on failure, await the thunk (see section 8).

Actions with optimistic behavior: `updateProfile`, `updateProfileBio`,
`addExperience`, `updateExperience`, `deleteExperience`, `addEducation`,
`updateEducation`, `deleteEducation`, `addSkill`, `deleteSkill`,
`createCollection`, `savePost`, `updateVerificationStatus`, `softDeleteProfile`,
`cancelProfileDeletion`.

---

## 5. Async thunks (dispatch these)

All are imported from `~/lib/profile/profile.store`. Dispatch as
`dispatch(thunkName(arg))`.

### Loading / reading

| Thunk | Arg | Does |
|-------|-----|------|
| `loadProfile` | `userId: string` | Loads just the `profiles` row into `profile` |
| `loadCompleteProfile` | `userId: string` | Loads profile **+ experiences + education + skills** in one go |
| `loadConnections` | `userId: string` | Loads accepted connections |
| `loadAllProfiles` | `{ excludeUserId?, filters? }` | Discovery/browse; `filters.page > 0` **appends** for infinite scroll |
| `searchUsers` | `{ query, filters? }` | Search users → `searchResults` |
| `loadVerificationStatus` | `userId: string` | Loads verification status |
| `loadCompletionScore` | `userId: string` | Loads completion % → `completionScore` |
| `loadCollections` | `userId: string` | Loads collections |
| `loadSavedPosts` | `userId: string` | Loads saved posts |

### Profile writes (optimistic)

| Thunk | Arg | Does |
|-------|-----|------|
| `updateProfile` | `{ userId, updates: ProfileUpdate }` | Patches profile fields |
| `updateProfileBio` | `{ userId, bio: string }` | Convenience for bio only |
| `uploadAvatar` | `{ userId, file: ProfileImageUpload }` | Uploads + sets `avatar_url` |
| `uploadCover` | `{ userId, file: ProfileImageUpload }` | Uploads + sets `cover_url` |
| `createInitialProfile` | `user: User` (Supabase auth user) | Creates the initial profile row |

`ProfileImageUpload = { blob: Blob | ArrayBuffer | File; mimeType: string; fileName?: string }`

### Experience / education / skills (optimistic)

| Thunk | Arg |
|-------|-----|
| `addExperience` | `{ userId, experience: ExperienceInput }` |
| `updateExperience` | `{ experienceId, updates: Partial<ExperienceInput> }` |
| `deleteExperience` | `experienceId: string` |
| `addEducation` | `{ userId, education: EducationInput }` |
| `updateEducation` | `{ educationId, updates: Partial<EducationInput> }` |
| `deleteEducation` | `educationId: string` |
| `addSkill` | `{ userId, skill: SkillInput }` |
| `deleteSkill` | `skillId: string` |

### Connections / follows

| Thunk | Arg | Does |
|-------|-----|------|
| `followUser` | `{ senderId, receiverId }` | Follows, then refreshes `connections` |
| `unfollowUser` | `{ senderId, receiverId }` | Unfollows, then refreshes `connections` |

> Connection **requests/accept/reject** live in `~/community/lib/network` and the
> `useProfileConnection` hook — the store delegates to them to avoid duplication.

### Verification & lifecycle (optimistic)

| Thunk | Arg | Does |
|-------|-----|------|
| `updateVerificationStatus` | `{ userId, verificationData: VerificationUpdate }` | Flips verification status |
| `softDeleteProfile` | `{ userId, reason? }` | Schedules deletion, marks account inactive |
| `cancelProfileDeletion` | `userId: string` | Reactivates a pending-deletion account |
| `blockUser` | `{ currentUserId, targetUserId }` | Blocks a user and removes the connection |
| `recordProfileView` | `{ profileUserId, viewerUserId? }` | Fire-and-forget analytics |

### Collections & saved posts (optimistic)

| Thunk | Arg |
|-------|-----|
| `createCollection` | `{ userId, name }` |
| `savePost` | `{ userId, postId, collectionNames? }` |

---

## 6. Sync actions (dispatch for pure UI state)

Imported from `~/lib/profile/profile.store`:

| Action | Arg | Does |
|--------|-----|------|
| `openEditModal` | `{ type, data? }` | Opens an edit modal |
| `closeEditModal` | — | Closes the edit modal |
| `setProfileError` | `string \| null` | Sets the error banner |
| `clearProfileError` | — | Clears the error |
| `resetProfile` | — | Resets the whole profile slice (e.g. on sign-out) |

---

## 7. Completion slice (`s.profileCompletion`)

Controls the "complete your basic profile" modal. `isBasicProfileCompleted` and
`isBasicProfileSkipped` are **persisted** across app restarts.

State: `showBasicProfileModal`, `isBasicProfileCompleted`, `isBasicProfileSkipped`,
`isLoading`, `error`, `profileCompletionScore`.

Actions (from `~/lib/profile/profile.store`):

| Action | Does |
|--------|------|
| `evaluateBasicProfileModal({ profile, completionScore })` | Decides whether to show the modal (handles reset logic) |
| `setShowBasicProfileModal(boolean)` | Force show/hide |
| `setBasicProfileCompleted(boolean)` | Mark completed + hide modal |
| `setBasicProfileSkipped(boolean)` | Mark skipped + hide modal |
| `setProfileCompletionScore(number \| null)` | Store the latest score |
| `resetCompletion()` / `resetCompletionStatus()` / `forceShowModal()` | Testing/utility resets |

```tsx
const dispatch = useAppDispatch()
const profile = useAppSelector((s) => s.profile.profile)
const score = useAppSelector((s) => s.profile.completionScore)
const showModal = useAppSelector((s) => s.profileCompletion.showBasicProfileModal)

useEffect(() => {
  dispatch(evaluateBasicProfileModal({ profile, completionScore: score }))
}, [dispatch, profile, score])
```

---

## 8. Reacting to success / failure

Thunks return a Promise you can `unwrap()` to branch on the result:

```tsx
import { unwrapResult } from '@reduxjs/toolkit'

async function onSave() {
  try {
    const result = await dispatch(updateProfile({ userId, updates })).unwrap()
    toast.show('Saved', { tone: 'success' })
  } catch (message) {
    // `message` is the string from the service; UI was already rolled back.
    toast.show('Save failed', { tone: 'danger', message: String(message) })
  }
}
```

If you don't care about the outcome, just `dispatch(...)` and render from
`state.profile.error` — it's set on any failure.

---

## 9. Validation helpers

Use these with the existing `useFormValidation` hook:

```tsx
import { useFormValidation } from '~/hooks/useFormValidation'
import { bioValidator, fullNameValidator } from '~/lib/profile/profile.validation'

const form = useFormValidation({
  schema: {
    full_name: { validators: [fullNameValidator] },
    bio: { validators: [bioValidator] },
  },
})

if (!form.validateAll()) return
```

Or validate an object directly before dispatching:

```tsx
import { validateProfileData } from '~/lib/profile/profile.validation'

const { isValid, errors } = validateProfileData(updates)
if (!isValid) return toast.show(errors.join(', '))
```

---

## 10. Common recipes

**Infinite-scroll discovery**

```tsx
const profiles = useAppSelector((s) => s.profile.allProfiles)
dispatch(loadAllProfiles({ excludeUserId: userId, filters: { page: nextPage, limit: 20 } }))
```

**Debounced search**

```tsx
import { debounce } from '~/lib/profile/profile.utils'
const search = useMemo(
  () => debounce((q: string) => dispatch(searchUsers({ query: q })), 300),
  [dispatch],
)
```

**Reset on sign-out**

```tsx
import { resetProfile } from '~/lib/profile/profile.store'
dispatch(resetProfile())
```

---

## 11. Do / Don't

- ✅ Dispatch thunks/actions from components; read via `useAppSelector`.
- ✅ Trust optimistic updates — don't manually mutate lists or refetch after a write.
- ✅ Use `.unwrap()` when you need to show success/error UI.
- ❌ Don't call `profile.service.*` directly from components (bypasses the store/optimistic layer).
- ❌ Don't store `Blob`/`File` in Redux state — pass them only as thunk args (e.g. `uploadAvatar`).
