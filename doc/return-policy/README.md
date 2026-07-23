# Return Policy — Developer Guide

Everything return-policy-related lives in **`lib/return-policy/`** and is exposed
through the same **Redux Toolkit** store used by shop, address, and payment
features. This guide is for UI developers building **vendor**, **admin**, or
**shared** surfaces — not buyer read-only flows (those stay in
`commerce/lib/return-policies.ts`).

> **TL;DR** — Import typed hooks, read state with `useAppSelector`, and trigger
> work with `dispatch(thunk(args))`. Mutations update the UI **optimistically**
> and roll back automatically if the server rejects them. All errors are already
> turned into friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `return-policy.constants.ts` | Limits, defaults, display labels, success messages |
| `return-policy.type.ts` | TypeScript types (`ReturnPolicy`, `ReturnPolicyInput`, `AssignedReturnPolicy`, …) |
| `return-policy.errors.ts` | **Centralised error handling** — `ReturnPolicyError`, `RETURN_POLICY_ERROR_CODES`, `toFriendlyReturnPolicyError()` |
| `return-policy.validation.ts` | **Zod** schemas + `validateReturnPolicyInput()` / `buildDefaultReturnPolicyFormData()` |
| `return-policy.utils.ts` | Pure helpers (sort, filter, format, defaults, optimistic builders) |
| `return-policy.service.ts` | Typed Supabase data-access. Dispatch thunks instead of calling directly. |
| `return-policy.store.ts` | Redux slice, async thunks, selectors. **Main entry point.** |
| `index.ts` | Barrel exports |

Redux key: **`returnPolicy`** (registered in `lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Shop ownership / admin access | `canManageShop()` from `~/lib/shop/shop.utils` |
| Buyer-facing listing policy read | `~/commerce/lib/return-policies.ts` (unchanged) |

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadReturnPolicies,
  createReturnPolicy,
  selectSortedReturnPolicies,
} from '~/lib/return-policy'

export function VendorReturnsScreen({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const policies = useAppSelector(selectSortedReturnPolicies)
  const error = useAppSelector((s) => s.returnPolicy.error)

  useEffect(() => {
    dispatch(loadReturnPolicies({ shopId }))
  }, [dispatch, shopId])

  return (
    <Button
      onPress={() =>
        dispatch(
          createReturnPolicy({
            shopId,
            input: {
              policy_name: 'Holiday Returns',
              return_window_days: 45,
            },
          }),
        )
      }
    >
      Add policy
    </Button>
  )
}
```

---

## 3. Admin flows

Pass optional `accessContext` on mutating thunks when acting on behalf of another shop:

```tsx
dispatch(
  updateReturnPolicy({
    policyId,
    input: { is_default: true },
    accessContext: { userId: adminUserId, role: 'A' },
  }),
)
```

The service uses `canManageShop()` so admins (`role: 'A'`) bypass strict owner checks while RLS still applies at the database layer.

---

## 4. Available thunks

| Thunk | Purpose |
|-------|---------|
| `loadReturnPolicies({ shopId, forceRefresh? })` | Fetch all shop policies (default first) |
| `createReturnPolicy({ shopId, input, accessContext? })` | Create policy |
| `updateReturnPolicy({ policyId, input, accessContext? })` | Update policy |
| `deleteReturnPolicy({ policyId, accessContext? })` | Delete policy |
| `loadListingReturnPolicies({ listingId, forceRefresh? })` | Policies assigned to a listing |
| `assignReturnPolicyToListing({ listingId, returnPolicyId, accessContext? })` | Link policy to listing |
| `removeReturnPolicyFromListing({ listingId, returnPolicyId, accessContext? })` | Unlink policy from listing |

All mutations use optimistic updates with safe rollback via request-scoped snapshots.

---

## 5. Validation

Use Zod-backed helpers before submit:

```tsx
import { validateReturnPolicyInput, getDefaultReturnPolicy } from '~/lib/return-policy'

const defaults = getDefaultReturnPolicy(shop.shop_name)
const result = validateReturnPolicyInput(formData)
if (!result.isValid) {
  // result.errors.field → message
}
```

Rules (ported 1:1 from legacy):

- Policy name required, max 100 chars
- Return window 1–365 days (default 30)
- Return shipping paid by: `buyer` | `seller`
- Condition description max 500 chars
- Policy details max 1000 chars

---

## 6. Legacy migration mapping

| Old (`sheconomy`) | New (`sheconomy-one`) |
|-------------------|------------------------|
| `listingProfileStore.js` → return slice | `return-policy.store.ts` |
| `returnPoliciesService` | `return-policy.service.ts` |
| `validateReturnPolicy` | `return-policy.validation.ts` |
| `formatReturnPolicy` / `sortReturnPolicies` | `return-policy.utils.ts` |
| `getDefaultReturnPolicy` | `getDefaultReturnPolicy()` in utils |
| Inline error strings | `return-policy.errors.ts` |

## 8. Vendor UI (settings → Return Policies)

Route: `/vendor/settings?section=returns`

| UI file | Role |
|---------|------|
| `commerce/screens/vendor/VendorReturnPolicySettings.tsx` | Settings shell |
| `commerce/screens/vendor/VendorReturnPolicyHubPanel.tsx` | Hub list, stats, search |
| `commerce/components/vendor/return-policy/ReturnPolicyFormDrawer.tsx` | Create / edit drawer |
| `commerce/components/ReturnPolicyErrorBoundary.tsx` | Friendly error surface |
| `lib/return-policy/return-policy-ui.copy.ts` | All user-facing strings |
| `lib/return-policy/return-policy-ui.utils.ts` | Hub stats, form mappers, window presets |

The hub dispatches thunks from `return-policy.store` — no direct Supabase calls in UI.


- TypeScript types aligned with Supabase `return_policies` / `listing_return_policies`
- Zod validation instead of manual string checks
- Centralised error codes + friendly messages (including legacy `error_code` mapping)
- Redux optimistic updates with explicit rollback registry
- Admin reuse via `ReturnPolicyAccessContext` + `canManageShop()`
- Constants file — no magic numbers or hardcoded copy in service/store logic
