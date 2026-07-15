# Address Store — Developer Guide

Everything address-related lives in **`lib/address/`** and is exposed through the
same **Redux Toolkit** store used by profiles and shops. This guide is for UI
developers building **buyer** (checkout / saved addresses), **vendor** (business
addresses), or **admin** (manage any user's addresses) surfaces.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Mutations update the UI
> **optimistically** and roll back automatically if the server rejects them.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/address/address.type.ts` | Types + constants (`Address`, `AddressFormData`, `ADDRESS_TYPE`, `ADDRESS_VALIDATION`, …) |
| `lib/address/address.errors.ts` | Centralised error handling — `AddressError`, `ADDRESS_ERROR_CODES`, `toFriendlyAddressError()` |
| `lib/address/address.validation.ts` | **Zod** schema + field validators |
| `lib/address/address.utils.ts` | Pure helpers (format, sort, group, stats, access checks) |
| `lib/address/address.service.ts` | Typed Supabase data-access (RPC + table). Dispatch thunks instead of calling directly. |
| `lib/address/address.store.ts` | Redux slice, async thunks, sync actions. **Main entry point.** |
| `commerce/components/AddressErrorBoundary.tsx` | Friendly error boundary for address screens |
| `commerce/components/address/AddressManager.tsx` | Full management UI (list, tabs, drawers) |
| `commerce/lib/addresses.ts` | Thin backward-compat wrappers for checkout |

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Country / state / city / postal validation | `~/lib/geo` (`LocationFields`, `validatePostalCode`) |
| Address form geo fields | `~/components/geo` |
| Supabase RPC | `get_user_addresses`, `delete_address`, `set_default_address`, `get_addresses_by_type` |

> **Google Places:** The legacy project used `useGooglePlaces` + `/api/places`.
> This codebase uses the built-in **geo picker** (`LocationFields` with
> `country-state-city`) instead — no extra API key required.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { createAddress, loadAddresses } from '~/lib/address/address.store'

export function MyAddressesScreen() {
  const dispatch = useAppDispatch()
  const addresses = useAppSelector((s) => s.address.addresses)
  const isLoading = useAppSelector((s) => s.address.isLoading)

  useEffect(() => {
    dispatch(loadAddresses(undefined))
  }, [dispatch])

  if (isLoading) return <Spinner />

  return (
    <Button
      onPress={() =>
        dispatch(
          createAddress({
            input: {
              address_line_1: '12 Main St',
              city: 'Mumbai',
              state: 'Maharashtra',
              postal_code: '400001',
              address_type: 'shipping',
              is_default: true,
            },
          }),
        )
      }
    >
      Add address
    </Button>
  )
}
```

---

## 3. State shape

`useAppSelector((s) => s.address.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `addresses` | `Address[]` | Sorted list (default-first, then by type) |
| `selectedAddressId` | `string \| null` | Currently selected row (persisted) |
| `viewedUserId` | `string \| null` | Whose addresses are loaded (admin) |
| `stats` | `AddressStats \| null` | Aggregated counts |
| `formData` | `AddressFormData` | Create/edit form buffer |
| `validation` | `{ isValid; errors }` | Result of `validateAddressForm` |
| `isLoading` / `isSaving` / `isDeleting` | `boolean` | In-flight flags |
| `error` | `string \| null` | Last friendly error message |
| `lastFetch` | `number \| null` | Cache timestamp for 30s TTL |

---

## 4. Optimistic UI

Mutations with optimistic behaviour:

| Thunk | Optimistic effect |
|-------|-------------------|
| `createAddress` | Inserts a `temp-…` row immediately |
| `updateAddress` | Merges patch into the matching row |
| `deleteAddress` | Removes the row from the list |
| `setDefaultAddress` | Swaps `is_default` flags within the same type |

On `rejected`, the previous snapshot is restored and `error` is set.

---

## 5. Async thunks

All imported from `~/lib/address/address.store`.

### User / vendor

| Thunk | Arg | Does |
|-------|-----|------|
| `loadAddresses` | `{ targetUserId?, forceRefresh? }` | Loads all addresses (30s cache unless forced) |
| `loadAddressesByType` | `{ addressType, targetUserId? }` | Filtered list via RPC |
| `loadAddressStats` | `targetUserId?` | Computes stats panel data |
| `createAddress` | `{ input, userId? }` | Creates row (optimistic) |
| `updateAddress` | `{ addressId, input }` | Patches row (optimistic) |
| `deleteAddress` | `addressId` | Deletes via RPC (optimistic) |
| `setDefaultAddress` | `addressId` | Sets default for type (optimistic) |

### Admin

Pass `targetUserId` to `loadAddresses` / `loadAddressStats` to view another
user's addresses. RLS + RPC enforce that only admins can read across users.

Gate UI with `canViewUserAddresses(targetUserId, viewerId, role)` and
`canManageAddress(address, userId, role)` from `address.utils`.

---

## 6. Sync actions

| Action | Does |
|--------|------|
| `setAddressFormData` | Merge into form buffer |
| `updateAddressField` | Set one form field |
| `loadFormFromAddress` | Seed form from an `AddressFormData` |
| `resetAddressFormData` | Clear form + validation |
| `validateAddressForm` | Run Zod → `s.address.validation` |
| `selectAddress` / `clearAddressSelection` | Selection state |
| `setAddressError` / `clearAddressError` | Banner control |
| `resetAddress` | Reset slice (sign-out) |

---

## 7. Errors & toasts

```tsx
import { useAppToast } from '~/components/ui'
import { createAddress } from '~/lib/address/address.store'

const toast = useAppToast()

try {
  await dispatch(createAddress({ input: formData })).unwrap()
  toast.show('Address saved', { tone: 'success' })
} catch (message) {
  toast.show('Could not save address', { tone: 'danger', message: String(message) })
}
```

Wrap screens in the boundary:

```tsx
import { AddressErrorBoundary } from '~/commerce/components/AddressErrorBoundary'

<AddressErrorBoundary scope="Checkout" onReset={() => dispatch(loadAddresses({ forceRefresh: true }))}>
  <AddressManager />
</AddressErrorBoundary>
```

---

## 8. UI components (drawer-based)

The legacy project used modals/dialogs. This migration uses **right drawers**
(matching vendor order drawers):

| Component | Role |
|-----------|------|
| `AddressManager` | Full page: stats, type tabs, list, add button |
| `AddressFormDrawer` | Create / edit form (replaces `AddressForm` dialog) |
| `AddressDeleteDrawer` | Delete confirmation (replaces `AddressDeleteDialog`) |
| `AddressList` | Card list with edit / default / delete actions |
| `AddressStatsPanel` | Summary cards |

`/addresses` route renders `AddressesScreen` → `AddressManager`.

---

## 9. Address types

| Type key | Label | Typical use |
|----------|-------|-------------|
| `home` | Home | Personal |
| `work` | Work | Office |
| `shipping` | Shipping | Checkout / delivery |
| `billing` | Billing | Invoices |
| `business` | Business | Vendor storefront |

Only **one default per type** per user (enforced by DB trigger + `set_default_address` RPC).

---

## 10. Do / Don't

- ✅ Dispatch thunks; read via `useAppSelector`.
- ✅ Use `LocationFields` for country/state/city/postal (not hardcoded state lists).
- ✅ Use `.unwrap()` for toasts; `s.address.error` is always friendly.
- ✅ Gate admin UI with `canViewUserAddresses` / `canManageAddress`.
- ❌ Don't call `address.service.*` directly from components.
- ❌ Don't use modals for address forms — use the drawer components.
