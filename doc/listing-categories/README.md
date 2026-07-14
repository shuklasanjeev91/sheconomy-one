# Categories Store — Developer Guide

Everything category-related lives in **`lib/listing/listing-categories.*`** and is
exposed through the same **Redux Toolkit** store used by profiles, shops and
listings. This guide is for UI developers who want to read the category taxonomy
and dispatch category actions from screens/components — whether you're building
**buyer** (browse / breadcrumb / picker), **vendor** (suggest / assign to my
listings) or **admin** (full CRUD / status / stats) surfaces.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Mutations update the UI
> **optimistically** (instantly) and roll back automatically if the server
> rejects them. All errors are already turned into friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/listing/listing-categories.type.ts` | All TypeScript types + constants (`Category`, `CategoryInsert`, `CategoryFormData`, `CategoryStatus`, `CATEGORY_STATUS`, `CATEGORY_STATUS_OPTIONS`, `CATEGORY_LIMITS`, `getDefaultCategoryFormData`, `categoryToFormData`, …) |
| `lib/listing/listing-categories.errors.ts` | **Centralised category error handling** — `CategoryError`, `CATEGORY_ERROR_CODES`, `toFriendlyCategoryError()`, `classifyCategoryError()` |
| `lib/listing/listing-categories.validation.ts` | **Zod** schemas (`createCategorySchema`, `updateCategorySchema`, `moveCategorySchema`, `bulkCategoryAssignmentSchema`, …) + field validators + `validateCategoryData` / `validateCategoryOperation` |
| `lib/listing/listing-categories.utils.ts` | Pure helpers (tree build/flatten, breadcrumb, seo name, hierarchy checks, `getCategoryImage`, `canManageCategory`) |
| `lib/listing/listing-categories.access.ts` | Shared response (`ok`/`fail`) + permission helpers (`checkCategoryPermission`, `assertCategoryDeletable`, `verifyListingCategoryAccess`). Reuses `resolveUserId` / `isAdminUser` from `listing.access` (no duplication). |
| `lib/listing/listing-categories.service.ts` | Typed Supabase data-access (categories + RPCs + admin). You normally **don't** call these directly — dispatch thunks. |
| `lib/listing/listing-categories.store.ts` | Main Redux slice, thunks, sync actions. **Your main entry point.** |
| `commerce/components/CategoryErrorBoundary.tsx` | Error boundary that renders friendly category errors + a retry action |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`** |

The Redux `<Provider>` is already wired at the app root (`app/_layout.tsx`). The
slice persists `categories` + `popularCategories` so category pickers and
navigation paint instantly on reload.

### Reuse note (no duplication)

| Concern | Source |
|---------|--------|
| Paginated list / filters | `categories` table (`getCategories`) |
| One level of children (with `has_children`) | `get_category_children` RPC (`getCategoryHierarchy`) |
| Breadcrumb ancestry | `get_category_path` RPC (`getCategoryPath`) |
| Full tree with product counts | `get_category_tree_with_counts` RPC (`getCategoryTreeWithCounts`) |
| Atomic listing assignment | `assign_categories_to_listing` RPC (`assignCategoriesToListing`) |
| Admin aggregate stats | `get_category_statistics` RPC (`getCategoryStatistics`) |
| Identity / admin check | `resolveUserId` / `isAdminUser` from `listing.access` |

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadCategories, setCategoryStatus } from '~/lib/listing/listing-categories.store'

export function CategoriesScreen() {
  const dispatch = useAppDispatch()
  const categories = useAppSelector((s) => s.categories.categories)
  const isLoading = useAppSelector((s) => s.categories.isLoading)

  useEffect(() => {
    dispatch(loadCategories({ filters: { parent_id: null } })) // top-level categories
  }, [dispatch])

  if (isLoading) return <Spinner />

  return categories.map((category) => (
    <Row key={category.category_id}>
      {category.category}
      <Button onPress={() => dispatch(setCategoryStatus({ categoryId: category.category_id, status: 'H' }))}>
        Hide
      </Button>
    </Row>
  ))
}
```

That `setCategoryStatus` call flips the category to hidden **immediately**; if
the API rejects it, the previous status is restored and `s.categories.error` is
set.

---

## 3. State shape

Read via `useAppSelector((s) => s.categories.<field>)`.

| Field | Type | Meaning |
|-------|------|---------|
| `categories` | `Category[]` | The flat list from the last `loadCategories` (persisted) |
| `categoryTree` | `CategoryTreeItem[]` | Nested tree rebuilt from `categories` after every change |
| `currentCategory` | `CategoryWithRelations \| null` | Detail row + immediate parent + active children |
| `categoryPath` | `CategoryPathRow[]` | Breadcrumb ancestry (root → current) |
| `hierarchyChildren` | `CategoryChildRow[]` | Last-fetched hierarchy level via the RPC |
| `treeWithCounts` | `CategoryTreeCountRow[]` | Full tree with rolled-up product counts |
| `popularCategories` | `Category[]` | Popular categories (persisted) |
| `searchResults` | `Category[]` | Results of the last `searchCategories` |
| `listingCategories` | `Record<string, ListingCategoryRow[]>` | Categories assigned to a listing, keyed by listing id |
| `adminCategories` | `Category[]` | Admin "all statuses" list |
| `statistics` | `CategoryStatistics \| null` | Admin aggregate counts |
| `filters` | `CategoryFilters` | Current query filters |
| `formData` | `CategoryFormData` | Create/edit form buffer |
| `validation` | `{ isValid; errors }` | Result of `validateCategoryForm` |
| `total` / `hasMore` / `offset` | pagination | Offset-based paging |
| `isLoading` / `isSearching` / `isLoadingDetails` / `isCreating` / `isUpdating` / `isDeleting` | `boolean` | In-flight flags |
| `error` | `string \| null` | Last **friendly** error message (cleared on next action) |

---

## 4. How optimistic UI works (important)

Every **mutation** thunk follows the same three-phase lifecycle:

1. **`pending`** → the change is applied to Redux state **right away** so the UI
   updates instantly. `createCategory` inserts a temporary row with a `temp-…`
   id; update/move/status/delete patch the collections immediately.
2. **`fulfilled`** → the optimistic value is reconciled with the **authoritative
   server row** (temp row swapped for the real one, patches replaced).
3. **`rejected`** → the change is **rolled back** to the previous state and
   `error` is set (already a friendly message).

Snapshots used for rollback are kept outside Redux state (keyed by the thunk's
`requestId`), so state stays serializable. `categoryTree` is rebuilt from
`categories` on every mutation, so tree views stay in sync automatically.

Optimistic actions: `createCategory`, `updateCategory`, `deleteCategory`,
`moveCategory`, `setCategoryStatus`.

**What this means for you:** just dispatch and render from state. No manual list
mutation or refetch after a write.

---

## 5. Async thunks (dispatch these)

### Buyer / public — `~/lib/listing/listing-categories.store`

| Thunk | Arg | Does |
|-------|-----|------|
| `loadCategories` | `{ filters?: CategoryFilters, append? }` | Paginated categories (defaults to active). `filters.offset > 0` **appends** |
| `loadCategoryById` | `categoryId` | Loads `currentCategory` (detail + parent + children) |
| `loadCategoryHierarchy` | `parentId?` | One level of children via `get_category_children` |
| `loadCategoryPath` | `categoryId` | Breadcrumb ancestry via `get_category_path` |
| `loadCategoryTree` | `{ rootId?, maxDepth?, langCode? }` | Full tree with counts |
| `searchCategories` | `{ term, options? }` | Name/description search (min 2 chars) |
| `loadPopularCategories` | `limit?` | Loads `popularCategories` |
| `loadListingCategories` | `listingId` | Loads a listing's assigned categories |

### Vendor

| Thunk | Arg | Does |
|-------|-----|------|
| `createCategory` | `{ formData, userId? }` | Creates a category (vendors → pending approval), optimistic |
| `assignCategoriesToListing` | `{ listingId, categories, userId? }` | Attach categories to a listing you own (RPC) |

### Admin

| Thunk | Arg | Does |
|-------|-----|------|
| `loadAdminCategories` | `{ filters?, append? }` | Categories across **all** statuses → `adminCategories` |
| `updateCategory` | `{ categoryId, updates, userId? }` | Patch any category, optimistic |
| `moveCategory` | `{ categoryId, moveInput, userId? }` | Re-parent / re-order (circular-safe), optimistic |
| `deleteCategory` | `{ categoryId, userId? }` | Delete (blocked if it has children/assignments), optimistic |
| `setCategoryStatus` | `{ categoryId, status, userId? }` | Enable / disable / hide, optimistic |
| `loadCategoryStatistics` | `userId?` | Loads `statistics` (admin only) |

> Admin thunks read/write across **all** categories; authorisation is enforced
> by Supabase RLS. Use `canManageCategory(role)` / `canCreateCategory(role)`
> from `listing-categories.utils` to gate admin/vendor UI.

---

## 6. Sync actions (pure UI / form state)

Imported from `~/lib/listing/listing-categories.store`:

| Action | Arg | Does |
|--------|-----|------|
| `setCategoryFilters` | `Partial<CategoryFilters>` | Merge into filters (resets offset unless supplied) |
| `setCategoryFormData` | `Partial<CategoryFormData>` | Merge into the form buffer |
| `updateCategoryField` | `{ field, value }` | Set one form field |
| `loadFormFromCategory` | `Category` | Seed the form from an existing category |
| `resetCategoryFormData` | — | Clear the form + validation |
| `validateCategoryForm` | — | Run Zod validation → `s.categories.validation` |
| `setCurrentCategory` | `CategoryWithRelations \| null` | Set the viewed detail |
| `clearCategorySearch` | — | Clear search results |
| `clearCategoryError` | — | Clear the error banner |
| `resetCategories` | — | Reset the whole slice (e.g. on sign-out) |

---

## 7. Errors & toasts (meaningful messages)

Every service failure is routed through **`toFriendlyCategoryError`**, so
`s.categories.error` is always human-readable. To show a toast, `unwrap()` the
thunk:

```tsx
import { useAppToast } from '~/components/ui'
import { createCategory } from '~/lib/listing/listing-categories.store'

const toast = useAppToast()

async function onCreate() {
  try {
    await dispatch(createCategory({ formData })).unwrap()
    toast.show('Category created', { tone: 'success' })
  } catch (message) {
    // `message` is already a friendly string; the UI was rolled back.
    toast.show('Couldn’t create category', { tone: 'danger', message: String(message) })
  }
}
```

Wrap category screens in the boundary to catch render-time failures:

```tsx
import { CategoryErrorBoundary } from '~/commerce/components/CategoryErrorBoundary'

<CategoryErrorBoundary scope="AdminCategories" onReset={() => dispatch(loadAdminCategories(undefined))}>
  <AdminCategoriesScreen />
</CategoryErrorBoundary>
```

Need to classify an error yourself? Use `classifyCategoryError(error)` →
`CATEGORY_ERROR_CODES.*` (includes `HAS_CHILDREN`, `HAS_ASSIGNMENTS`,
`CIRCULAR_REFERENCE`, `SEO_NAME_TAKEN`, …).

---

## 8. Validation (Zod + form fields)

For full-object validation use `validateCategoryData` (Zod under the hood).
`category` is required; everything else is optional with sensible defaults:

```tsx
import { validateCategoryData } from '~/lib/listing/listing-categories.validation'

const { isValid, errors } = validateCategoryData(formData)
if (!isValid) return toast.show(Object.values(errors)[0])
```

For live form fields, plug the validators into `useFormValidation`:

```tsx
import { useFormValidation } from '~/hooks/useFormValidation'
import { categoryNameValidator, categorySeoNameValidator } from '~/lib/listing/listing-categories.validation'

const form = useFormValidation({
  category: { validators: [categoryNameValidator] },
  seo_name: { validators: [categorySeoNameValidator] },
})

if (!form.validateAll()) return
```

For operation-scoped validation (used by the service) use
`validateCategoryOperation(data, 'create' | 'update' | 'query' | 'move' | 'assignment' | 'bulk-assignment')`.

---

## 9. Display & domain helpers (`listing-categories.utils`)

| Helper | Does |
|--------|------|
| `buildCategoryTree(categories, parentId?)` | Flat array → nested tree (sorted by position) |
| `flattenCategoryTree(tree)` | Nested tree → flat array with `level` + `hasChildren` |
| `findCategoryInTree(tree, id)` | Depth-first lookup |
| `getCategoryParents` / `getCategoryDescendants` / `calculateCategoryDepth` | Hierarchy walks |
| `validateCategoryHierarchy(cats, id, newParentId)` | Pure circular-reference / missing-parent check |
| `buildCategoryBreadcrumb(path)` | Breadcrumb items for navigation |
| `generateCategorySeoName(name)` | URL-friendly SEO slug |
| `generateCategoryUrl(category)` | Category page URL |
| `getCategoryImage(category)` | Resolve the best image (column → `main_pair` JSONB) |
| `getCategoryStatusLabel(status)` | Human label for a status code |
| `extractCategorySeoMeta(category)` | Title/description/OG metadata |
| `sortCategoriesHierarchically` / `filterCategoriesBySearch` / `groupCategoriesByLevel` | Client-side list ops |
| `canManageCategory(role)` / `canCreateCategory(role)` | Admin / vendor UI gates |

---

## 10. Common recipes

**Category picker (top level + drill-down)**

```tsx
dispatch(loadCategories({ filters: { parent_id: null } }))     // roots
dispatch(loadCategories({ filters: { parent_id: category.category_id } })) // children
```

**Breadcrumb for a category page**

```tsx
useEffect(() => { dispatch(loadCategoryPath(categoryId)) }, [categoryId])
const path = useAppSelector((s) => s.categories.categoryPath)
```

**Attach categories to a listing (vendor)**

```tsx
await dispatch(assignCategoriesToListing({
  listingId,
  categories: [{ category_id: '103', is_primary: true }, { category_id: '16' }],
})).unwrap()
```

**Admin: dashboard stats + manage all categories**

```tsx
dispatch(loadCategoryStatistics())
dispatch(loadAdminCategories({ filters: { status: null } })) // all statuses
dispatch(setCategoryStatus({ categoryId, status: 'D' }))     // disable
```

**Reset on sign-out**

```tsx
dispatch(resetCategories())
```

---

## 11. Data model notes

The `categories` table is a **hierarchical, SEO-aware, multi-language** taxonomy
(migrated from CS-Cart). Key columns:

- `category_id` — text primary key (`CAT_<uuid>` for new rows, legacy numeric ids
  such as `'103'` are also supported).
- `parent_id` — self-referencing FK; `id_path`, `level`, `seo_path` are
  auto-generated by DB triggers on insert/update.
- `status` — `category_status_enum` (`A` active / `D` disabled / `H` hidden).
- `product_count` — kept up to date by a trigger on `category_assignments`.
- `main_pair` / `category_meta` — JSONB (legacy CS-Cart image + metadata). Read
  images via `getCategoryImage`; the new dedicated columns
  (`category_image_url`, `category_icon`, `og_image`, `meta_title`) are preferred.

`category_assignments` links categories to listings (`is_primary`, one primary
per listing enforced by a trigger). `category_translations` holds per-language
overrides.

---

## 12. Do / Don't

- ✅ Dispatch thunks/actions; read via `useAppSelector`.
- ✅ Trust optimistic updates — don't manually mutate lists or refetch after a write.
- ✅ Use `.unwrap()` when you need success/error toasts; `s.categories.error` is always friendly.
- ✅ Gate admin/vendor UI with `canManageCategory(role)` / `canCreateCategory(role)`.
- ✅ Read images with `getCategoryImage` so legacy `main_pair` payloads still resolve.
- ❌ Don't call `listing-categories.service.*` directly from components (bypasses the store/optimistic layer).
- ❌ Don't hardcode status strings — use `CATEGORY_STATUS` / `CATEGORY_STATUS_OPTIONS`.
- ❌ Don't delete a category with children or product assignments — the service blocks it with a friendly error.
