# Shop Store — Developer Guide

Everything shop-related lives in **`lib/shop/`** and is exposed through the same
**Redux Toolkit** store used by profiles. This guide is for UI developers who
want to read shop state and dispatch shop actions from screens/components —
whether you're building **buyer** (browse/follow), **vendor** (create/manage),
or **admin** (verify/activate) surfaces.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Mutations update the UI
> **optimistically** (instantly) and roll back automatically if the server
> rejects them. All errors are already turned into friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/shop/shop.type.ts` | All TypeScript types + constants (`Shop`, `ShopUpdate`, `ShopFormData`, `SUPPORTED_CURRENCIES`, `SHOP_CREATION_STEPS`, …) |
| `lib/shop/shop.errors.ts` | **Centralised shop error handling** — `ShopError`, `SHOP_ERROR_CODES`, `toFriendlyShopError()` |
| `lib/shop/shop.validation.ts` | **Zod** schema (`shopSchema`) + field validators for `useFormValidation` |
| `lib/shop/shop.utils.ts` | Pure helpers (currency, slug, hours, completion %, filtering/sorting, `canManageShop`) |
| `lib/shop/shop.service.ts` | Typed Supabase data-access functions. You normally do **not** call these directly — dispatch thunks instead. |
| `lib/shop/shop.store.ts` | Redux slice, async thunks, sync actions. **This is your main entry point.** |
| `commerce/components/ShopErrorBoundary.tsx` | Error boundary that renders friendly shop errors + a retry action |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`** |

The Redux `<Provider>` is already wired at the app root (`app/_layout.tsx`), and
the shop slice (`currentShop`, `myShops`) is **persisted**, so a vendor's shop
paints instantly on reload.

### Reuse note (no duplication)

The service **delegates** to existing commerce modules rather than reimplementing:

| Concern | Delegates to |
|---------|--------------|
| Create shop | `~/commerce/lib/shops` (`seller_create_shop_with_points` RPC) |
| Follow / unfollow | `~/commerce/lib/shop-follows` |
| Seller dashboard | `~/commerce/lib/seller-dashboard` |
| Logo upload | `~/lib/supabase/storage-upload` |
| Currency formatting | `~/lib/format` (`formatCurrency`) |

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadMyShops, updateShop } from '~/lib/shop/shop.store'

export function MyShopScreen() {
  const dispatch = useAppDispatch()
  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoading = useAppSelector((s) => s.shop.isLoadingShops)

  useEffect(() => {
    dispatch(loadMyShops(undefined)) // undefined → use the signed-in user
  }, [dispatch])

  if (isLoading) return <Spinner />
  if (!shop) return <CreateShopCta />

  return (
    <Button
      onPress={() =>
        dispatch(updateShop({ shopId: shop.id, updates: { shop_description: 'New tagline' } }))
      }
    >
      Save
    </Button>
  )
}
```

That `updateShop` call changes the visible shop **immediately**; if the API call
fails, the previous values are restored and `s.shop.error` is set.

---

## 3. State shape

`useAppSelector((s) => s.shop.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `myShops` | `Shop[]` | Shops owned by the current user |
| `currentShop` | `Shop \| null` | The active/selected owned shop (persisted) |
| `viewedShop` | `Shop \| null` | A shop being viewed (public storefront / detail) |
| `publicShops` | `ShopSummary[]` | Public browse/directory results (paginated) |
| `followedShops` | `Shop[]` | Shops the user follows |
| `adminShops` | `Shop[]` | Admin "all shops" list (paginated) |
| `shopStats` | `ShopStats \| null` | Normalised listing stats for a shop |
| `shopSummary` | `ShopListingsSummary \| null` | Raw summary-view row |
| `dashboard` | `ShopDashboardData \| null` | Seller dashboard bundle (summary + sales + stats) |
| `platformStats` | `PlatformShopStats \| null` | Admin counts (total/active/verified/pending) |
| `isFollowingViewedShop` | `boolean` | Follow state for `viewedShop` |
| `formData` | `ShopFormData` | Create/edit form buffer |
| `validation` | `{ isValid; errors }` | Result of `validateForm` |
| `isLoading` / `isLoadingShops` / `isCreating` / `isUpdating` / `isDeleting` / `isLoadingStats` | `boolean` | In-flight flags |
| `error` | `string \| null` | Last **friendly** error message (cleared on next action) |
| `hasMorePublicShops` / `totalPublicShops` | pagination | Public feed paging |
| `hasMoreAdminShops` / `totalAdminShops` | pagination | Admin feed paging |

---

## 4. How optimistic UI works (important)

Every **mutation** thunk follows the same three-phase lifecycle:

1. **`pending`** → the change is applied to Redux state **right away** so the UI
   updates instantly. `createShop` inserts a temporary row with a `temp-…` id.
2. **`fulfilled`** → the optimistic value is reconciled with the **authoritative
   server row** (temp row swapped for the real one, patches replaced).
3. **`rejected`** → the change is **rolled back** to the previous state and
   `error` is set (already a friendly message).

Snapshots used for rollback are kept outside Redux state (keyed by the thunk's
`requestId`), so state stays serializable.

Actions with optimistic behavior: `createShop`, `updateShop`, `deleteShop`,
`uploadShopLogo`, `followShop`, `unfollowShop`, `verifyShop`, `setShopActiveAdmin`,
`adminUpdateShop`.

**What this means for you:** just dispatch and render from state. No manual list
mutation or refetch after a write.

---

## 5. Async thunks (dispatch these)

All imported from `~/lib/shop/shop.store`.

### Buyer / public

| Thunk | Arg | Does |
|-------|-----|------|
| `loadPublicShops` | `{ filters?, pagination? }` | Verified+active directory; `pagination.offset > 0` **appends** for infinite scroll |
| `loadShopById` | `shopId: string` | Loads a shop into `viewedShop` |
| `loadShopBySlug` | `slug: string` | Loads a shop into `viewedShop` |
| `checkFollowingShop` | `{ shopId, userId }` | Sets `isFollowingViewedShop` |
| `followShop` | `{ shopId, userId }` | Follows (optimistic; blocks following your own shop) |
| `unfollowShop` | `{ shopId, userId }` | Unfollows (optimistic) |
| `loadFollowedShops` | `userId: string` | Loads `followedShops` |

### Vendor

| Thunk | Arg | Does |
|-------|-----|------|
| `loadMyShops` | `userId?: string` | Loads `myShops` (+ seeds `currentShop`) |
| `loadMyShop` | `userId?: string` | Loads the primary active shop into `currentShop` |
| `createShop` | `{ formData, userId? }` | Creates a shop (RPC + extra fields), optimistic |
| `updateShop` | `{ shopId, updates: ShopUpdate }` | Patches shop fields, optimistic |
| `deleteShop` | `shopId: string` | Soft-deletes (marks inactive), optimistic |
| `uploadShopLogo` | `{ userId, shopId, file: ShopImageUpload }` | Uploads + sets `logo_url` |
| `loadShopStats` | `shopId: string` | Loads normalised `shopStats` |
| `loadShopSummary` | `shopId: string` | Loads raw `shopSummary` |
| `loadShopDashboard` | `shopId: string` | Loads `dashboard` (summary + sales + stats) |

### Admin

| Thunk | Arg | Does |
|-------|-----|------|
| `loadAdminShops` | `{ filters?, pagination? }` | All shops incl. unverified/inactive → `adminShops` (paginated) |
| `verifyShop` | `{ shopId, verified }` | Verify/unverify, optimistic |
| `setShopActiveAdmin` | `{ shopId, isActive }` | Activate/deactivate, optimistic |
| `adminUpdateShop` | `{ shopId, updates }` | Update any shop, optimistic |
| `loadPlatformStats` | — | Loads `platformStats` counts |

> Admin thunks read/write across **all** shops; the actual authorisation is
> enforced by Supabase RLS. Use `canManageShop(shop, userId, role)` from
> `shop.utils` to gate admin/owner UI.

---

## 6. Sync actions (pure UI / form state)

Imported from `~/lib/shop/shop.store`:

| Action | Arg | Does |
|--------|-----|------|
| `setShopFormData` | `Partial<ShopFormData>` | Merge into the form buffer |
| `updateShopField` | `{ field, value }` | Set one form field |
| `loadFormFromShop` | `ShopFormData` | Seed the form from a shop (use `shopToFormData(shop)`) |
| `resetShopFormData` | — | Clear the form + validation |
| `validateForm` | — | Run Zod validation → `s.shop.validation` |
| `setCurrentShop` / `setViewedShop` | `Shop \| null` | Set the active / viewed shop |
| `setShopError` / `clearShopError` | `string \| null` / — | Error banner control |
| `resetShop` | — | Reset the whole slice (e.g. on sign-out) |

---

## 7. Errors & toasts (meaningful messages)

Every service failure is routed through **`toFriendlyShopError`**, so
`s.shop.error` is always human-readable. To show a toast, `unwrap()` the thunk:

```tsx
import { unwrapResult } from '@reduxjs/toolkit'
import { useAppToast } from '~/components/ui'
import { createShop } from '~/lib/shop/shop.store'

const toast = useAppToast()

async function onCreate() {
  try {
    await dispatch(createShop({ formData })).unwrap()
    toast.show('Shop created', { tone: 'success' })
  } catch (message) {
    // `message` is already a friendly string; UI was rolled back.
    toast.show('Couldn’t create shop', { tone: 'danger', message: String(message) })
  }
}
```

Wrap shop screens in the boundary to catch render-time failures:

```tsx
import { ShopErrorBoundary } from '~/commerce/components/ShopErrorBoundary'

<ShopErrorBoundary scope="SellerDashboard" onReset={() => dispatch(loadMyShops(undefined))}>
  <SellerDashboardScreen />
</ShopErrorBoundary>
```

Need to classify an error yourself? Use `classifyShopError(error)` →
`SHOP_ERROR_CODES.*`.

---

## 8. Validation (Zod + form fields)

For full-object validation, use the Zod schema via `validateShopData`:

```tsx
import { validateShopData } from '~/lib/shop/shop.validation'

const { isValid, errors } = validateShopData(formData)
if (!isValid) return toast.show(Object.values(errors)[0])
```

For live form fields, plug the validators into `useFormValidation` (same as
profiles):

```tsx
import { useFormValidation } from '~/hooks/useFormValidation'
import { shopNameValidator, shopEmailValidator } from '~/lib/shop/shop.validation'

const form = useFormValidation({
  shop_name: { validators: [shopNameValidator] },
  shop_email: { validators: [shopEmailValidator] },
})

if (!form.validateAll()) return
```

Multi-step flows: `validateShopStep(stepId, data)` returns `{ isValid, errors, isComplete }`.

---

## 9. Currency & display helpers (`shop.utils`)

| Helper | Does |
|--------|------|
| `formatShopCurrency(amount, currency)` | Locale-aware money formatting (wraps `~/lib/format`) |
| `getCurrencySymbol(code)` / `getCurrencyName(code)` | Symbol / name lookup |
| `getCurrentShopUtils(shop)` | `{ currency, currencySymbol, formatAmount, … }` bundle |
| `generateShopSlug(name)` | URL-friendly slug |
| `isShopOwner(shop, userId)` / `canManageShop(shop, userId, role)` | Ownership / admin checks |
| `formatShopHours(hours)` / `isShopOpen(hours)` | Hours display + open/closed |
| `validateSocialLinks(links)` | Keep known platforms, normalise URLs |
| `filterShopsByCategories` / `searchShops` / `sortShops` | Pure client-side list ops |
| `getShopCompletionPercentage(shop)` | 0–100 completeness score |
| `formatShopForDisplay(shop)` / `shopToFormData(shop)` | Row → view model / form buffer |

---

## 10. Common recipes

**Create shop from the multi-step form**

```tsx
const formData = useAppSelector((s) => s.shop.formData)
dispatch(validateForm())
const { isValid } = useAppSelector((s) => s.shop.validation)
if (isValid) await dispatch(createShop({ formData })).unwrap()
```

**Infinite-scroll public directory**

```tsx
dispatch(loadPublicShops({ filters: { category }, pagination: { limit: 20, offset: nextOffset } }))
```

**Admin: verify a shop**

```tsx
dispatch(verifyShop({ shopId, verified: true }))
```

**Reset on sign-out**

```tsx
dispatch(resetShop())
```

---

## 11. Do / Don't

- ✅ Dispatch thunks/actions; read via `useAppSelector`.
- ✅ Trust optimistic updates — don't manually mutate lists or refetch after a write.
- ✅ Use `.unwrap()` when you need success/error toasts; `s.shop.error` is always friendly.
- ✅ Gate admin/owner UI with `canManageShop(shop, userId, role)`.
- ❌ Don't call `shop.service.*` directly from components (bypasses the store/optimistic layer).
- ❌ Don't store `Blob`/`File` in Redux — pass them only as thunk args (e.g. `uploadShopLogo`).
