# Company Pages Store — Developer Guide

Everything company-page related for **admin** (and reusable by community) lives in
**`lib/company-page/`** and is exposed through the same **Redux Toolkit** store used
by shops, sale events, and CMS.

> **TL;DR** — Import from `~/lib/company-page`, read with `useAppSelector((s) => s.companyPage.*)`,
> and mutate with `dispatch(thunk(args))`. Create / update / delete are **optimistic**
> and roll back on failure. Errors are always friendly via `company-page.errors`.

This module ports the legacy `companyActions.js` admin CRUD + the existing
`community/lib/companies.ts` patterns into a typed RTK layer against the
`companypages` schema.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/company-page/company-page.type.ts` | Types + constants (`CompanyPage`, `CompanyPageWithCounts`, sizes/types/categories, storage buckets) |
| `lib/company-page/company-page.errors.ts` | `CompanyPageError`, `COMPANY_PAGE_ERROR_CODES`, `classifyCompanyPageError`, `toFriendlyCompanyPageError` |
| `lib/company-page/company-page.validation.ts` | Zod schemas (`createCompanyPageSchema`, `updateCompanyPageSchema`, …) + `parseOrThrow` / `validate` |
| `lib/company-page/company-page.utils.ts` | Slug helpers, display labels, image validation |
| `lib/company-page/company-page.service.ts` | Typed Supabase data-access. Prefer thunks from UI. |
| `lib/company-page/company-page.store.ts` | Redux slice, async thunks, sync actions — **main entry for admin UI** |
| `lib/company-page/index.ts` | Barrel — `import { … } from '~/lib/company-page'` |

Slice key: **`state.companyPage`** (registered in `lib/store/index.ts`, not persisted).

### Schema (source of truth)

```sql
companypages (
  id uuid PK default uuid_generate_v4(),
  name text not null,
  page_slug text not null,
  website text null,
  industry text not null,
  size text not null,
  type text not null,
  logo_url text null,
  tagline text null,
  created_at timestamptz not null default now(),
  page_category text not null default 'Company',
  headquarters text null,
  founded_year integer null,
  community_members integer null,
  location text null,
  created_by uuid null → profiles(id),
  cover_url text null,
  raw_page_data jsonb null
)
```

After INSERT, trigger `companypages_ensure_owner_member` adds the creator as an
`owner` row in `company_members`.

### Related tables

| Table | Role |
|-------|------|
| `company_members` | Page managers (`owner` / `admin` / `member`) |
| `company_followers` | Follow graph |
| `posts.company_id` | Company feed posts |
| Storage `companypages-logos` | Logo images |
| Storage `company-covers` | Cover images |

### Existing community code (do not delete yet)

`community/lib/companies.ts` still powers the public community screens. When you
build the admin UI, use **`~/lib/company-page`**. A later cleanup can point
community screens at the same service layer.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadCompanyPages,
  loadCompanyPagePlatformStats,
  createCompanyPage,
} from '~/lib/company-page'

export function AdminCompanyPages() {
  const dispatch = useAppDispatch()
  const pages = useAppSelector((s) => s.companyPage.pages)
  const isLoading = useAppSelector((s) => s.companyPage.isLoadingList)

  useEffect(() => {
    dispatch(loadCompanyPages({ limit: 20, offset: 0 }))
    dispatch(loadCompanyPagePlatformStats())
  }, [dispatch])

  async function onCreate(formData: unknown) {
    try {
      await dispatch(createCompanyPage(formData)).unwrap()
    } catch (message) {
      // already a friendly string
      console.error(String(message))
    }
  }

  // render pages…
}
```

---

## 3. State shape

`useAppSelector((s) => s.companyPage.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `pages` | `CompanyPageWithCounts[]` | Admin list (follower/member/post counts + creator) |
| `totalPages` | `number` | Total matching rows (for pagination) |
| `hasMore` | `boolean` | More pages available |
| `currentPage` | `CompanyPageDetail \| null` | Open detail (members, followers, engagement) |
| `facets` | `CompanyPageFacets \| null` | Filter option lists |
| `platformStats` | `CompanyPagePlatformStats \| null` | Dashboard totals |
| `error` | `string \| null` | Last **friendly** error |
| `successMessage` | `string \| null` | Last success message |
| `isLoadingList` / `isLoadingDetail` / `isSaving` / `isDeleting` / … | `boolean` | In-flight flags |

---

## 4. How optimistic UI works

| Thunk | Optimistic behaviour |
|-------|----------------------|
| `createCompanyPage` | Prepends temp `optimistic-…` row; swaps on success; removes on failure |
| `updateCompanyPage` | Merges patch into list + detail; rolls back on failure |
| `deleteCompanyPage` | Removes row immediately; restores on failure |
| `removeCompanyMember` | Removes member from `currentPage.members`; restores on failure |

**Rule:** dispatch and render from state — no manual list mutation after a write.

---

## 5. Async thunks (dispatch these)

All imported from `~/lib/company-page`.

### Admin — pages

| Thunk | Arg | Does |
|-------|-----|------|
| `loadCompanyPages` | `{ filters?, limit?, offset? }` | List → `pages` (`offset > 0` appends) |
| `loadCompanyPageDetail` | `id` | Full detail → `currentPage` |
| `createCompanyPage` | form payload | Validates + creates (optimistic) |
| `updateCompanyPage` | `{ pageId, payload }` | Validates + updates (optimistic) |
| `deleteCompanyPage` | `pageId` | Deletes (optimistic) |
| `reassignCompanyPageOwner` | `{ pageId, newOwnerId }` | Updates `created_by` + ensures owner member |

### Admin — members

| Thunk | Arg | Does |
|-------|-----|------|
| `setCompanyMemberRole` | `{ companyId, userId, role: 'admin' \| 'member' }` | Calls RPC `set_company_member_role` |
| `removeCompanyMember` | `{ companyId, userId }` | Deletes non-owner membership (optimistic) |

### Admin — pickers / dashboard

| Thunk | Arg | Does |
|-------|-----|------|
| `loadCompanyPageFacets` | — | Industries / locations / sizes / types / categories |
| `loadCompanyPagePlatformStats` | — | Totals for admin header cards |

---

## 6. Service functions (when you need them outside Redux)

Prefer thunks. Call these only for uploads (Blobs must not enter Redux) or one-off scripts.

### CRUD

| Function | Purpose |
|----------|---------|
| `listCompanyPages` | Paginated filtered list + counts |
| `getCompanyPageById` | Single page + counts |
| `getCompanyPageBySlugOrId` | Resolve uuid **or** slug |
| `getCompanyPageDetail` | Page + members + followers + engagement |
| `createCompanyPage` | Insert (trigger adds owner member) |
| `updateCompanyPage` | Partial update |
| `deleteCompanyPage` | Hard delete |
| `reassignCompanyPageOwner` | Transfer `created_by` |

### Members / followers / engagement

| Function | Purpose |
|----------|---------|
| `getCompanyMembers` | Members with profile fields |
| `setCompanyMemberRole` | RPC promote/demote |
| `removeCompanyMember` | Remove non-owner |
| `getCompanyFollowerCount` | Count |
| `getCompanyFollowers` | Recent followers with profiles |
| `getCompanyPostCount` | Non-deleted posts |
| `getCompanyEngagementStats` | Aggregated `posts_with_stats` |

### Media

| Function | Purpose |
|----------|---------|
| `uploadCompanyLogo` / `deleteCompanyLogo` | `companypages-logos` bucket |
| `uploadCompanyCover` / `deleteCompanyCover` | `company-covers` bucket |
| `validateCompanyImageFile` (utils) | Type + size check before upload |

### Facets / stats

| Function | Purpose |
|----------|---------|
| `getCompanyPageFacets` | Filter menus |
| `getCompanyPagePlatformStats` | Admin dashboard cards |

### Upload recipe (logo / cover)

```tsx
import {
  uploadCompanyLogo,
  deleteCompanyLogo,
  validateCompanyImageFile,
  updateCompanyPage,
} from '~/lib/company-page'
import { pickedImageToBlob } from '~/lib/media/pick-image'

const blob = await pickedImageToBlob(picked)
const file = {
  blob,
  mimeType: picked.mimeType || 'image/jpeg',
  fileName: picked.fileName || 'logo.jpg',
  fileSize: picked.file?.size ?? blob.size,
}

const check = validateCompanyImageFile(file)
if (!check.valid) return toast.show(check.error!, { tone: 'danger' })

const res = await uploadCompanyLogo(file, pageId)
if (!res.success) return toast.show(res.error!, { tone: 'danger' })

await dispatch(
  updateCompanyPage({ pageId, payload: { logo_url: res.data!.url } }),
).unwrap()

// optional: deleteCompanyLogo(oldUrl) when replacing
```

Use Tamagui `Image` with **`src={url}`** (not `source={{ uri }}`) so logos/covers
render on web.

---

## 7. Sync actions

| Action | Does |
|--------|------|
| `setCurrentCompanyPage` | Set open detail |
| `clearCurrentCompanyPage` | Clear detail |
| `clearCompanyPageMessages` | Clear `error` + `successMessage` |
| `setCompanyPageError` | Set error banner manually |
| `resetCompanyPage` | Reset slice (e.g. sign-out) |

---

## 8. Errors & toasts

```tsx
import { useAppToast } from '~/components/ui'
import { deleteCompanyPage } from '~/lib/company-page'

const toast = useAppToast()

try {
  await dispatch(deleteCompanyPage(id)).unwrap()
  toast.show('Page deleted', { tone: 'success' })
} catch (message) {
  toast.show('Couldn’t delete page', { tone: 'danger', message: String(message) })
}
```

Known codes: `NOT_AUTHENTICATED`, `NOT_FOUND`, `PERMISSION_DENIED`, `SLUG_TAKEN`,
`DUPLICATE`, `INVALID_INPUT`, `NETWORK`, `UNKNOWN`.

---

## 9. Validation (Zod)

```tsx
import { validate, createCompanyPageSchema } from '~/lib/company-page'

const { success, data, errors } = validate(createCompanyPageSchema, formData)
if (!success) return toast.show(errors![0], { tone: 'danger' })
```

**Required on create:** `name`, `page_slug`, `industry`, `size`, `type`.

Optional: `page_category` (default `"Company"`), `website`, `logo_url`, `cover_url`,
`tagline`, `headquarters`, `founded_year`, `community_members`, `location`,
`created_by`, `raw_page_data`.

Suggested UI constants (also exported):

- `COMPANY_PAGE_SIZES` — `1-10`, `11-50`, …
- `COMPANY_PAGE_TYPES` — `company`, `nonprofit`, …
- `COMPANY_PAGE_CATEGORIES` — `Company`, `Organization`, …

---

## 10. Recommended admin UI integration steps

Follow this order when wiring `/admin/company-pages`:

1. **List screen** — `loadCompanyPages` + `loadCompanyPagePlatformStats` + facets filters.
2. **Create drawer** (`AppBottomSheet`) — form → `createCompanyPage`; logo/cover via upload helpers then pass URLs.
3. **Detail drawer** — `loadCompanyPageDetail`; show members / followers / engagement.
4. **Edit drawer** — `updateCompanyPage`; replace logo/cover and `deleteCompanyLogo` / `deleteCompanyCover` for old storage URLs.
5. **Delete confirm drawer** — `deleteCompanyPage` + best-effort media cleanup.
6. **Member tools** — `setCompanyMemberRole` / `removeCompanyMember` / `reassignCompanyPageOwner`.
7. Wrap the page in an error boundary (mirror `SaleEventErrorBoundary` if you add one).

Match existing admin patterns in:

- `app/admin/components/AdminShopsManager.tsx`
- `app/admin/components/AdminSaleEventsManager.tsx`

---

## 11. Do / Don't

- ✅ Dispatch thunks; read via `useAppSelector`.
- ✅ Trust optimistic updates.
- ✅ Use `.unwrap()` for toasts; `state.companyPage.error` is always friendly.
- ✅ Style flows with a **drawer** (`AppBottomSheet`), not a modal/dialog.
- ✅ Use `Image src={…}` for logo/cover on web.
- ❌ Don’t put `Blob` / `File` in Redux — upload via service, store only the URL.
- ❌ Don’t call service CRUD from components when a thunk exists (bypasses optimistic layer).
- ❌ Don’t invent a second slug ruleset — use `generateCompanyPageSlug` / `normalizeCompanyPageSlug`.

---

## 12. Quick reference — create payload

```ts
{
  name: 'Acme Studio',
  page_slug: 'acme-studio',
  industry: 'Design',
  size: '1-10',
  type: 'company',
  page_category: 'Company',
  tagline: 'Design that ships',
  website: 'https://example.com',
  location: 'Bengaluru',
  headquarters: 'Bengaluru',
  founded_year: 2020,
  logo_url: 'https://…/logo.jpeg',   // after uploadCompanyLogo
  cover_url: 'https://…/cover.jpeg', // after uploadCompanyCover
  created_by: '<optional-uuid>',     // defaults to signed-in user
}
```
