# Discount Store — Developer Guide

Everything discount-related lives in **`lib/discount/`** and is exposed through the same
**Redux Toolkit** store used by shop, sales analytics, and listing reviews. This guide is
for UI developers building **vendor** (manage promotions), **admin** (oversight), or
**buyer** (validate/apply codes) surfaces.

> **TL;DR** — Import typed hooks, read `s.discount.*`, dispatch thunks from
> `~/lib/discount/discount.store`. Mutations are **optimistic** with automatic rollback.
> Errors are normalized via `toFriendlyDiscountError()`.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/discount/discount.constants.ts` | Enums, BOGO templates, poster config, pagination/filter defaults |
| `lib/discount/discount.type.ts` | Typed models + service response shapes |
| `lib/discount/discount.errors.ts` | `DiscountError`, `DISCOUNT_ERROR_CODES`, `toFriendlyDiscountError()` |
| `lib/discount/discount.validation.ts` | Zod schemas + `buildDefaultDiscountFormValues()` |
| `lib/discount/discount.utils.ts` | Calculations, eligibility, formatting, optimistic helpers |
| `lib/discount/discount.service.ts` | Supabase data-access (dispatch thunks instead of calling directly) |
| `lib/discount/discount.store.ts` | Redux slice + async thunks — **main entry point** |
| `lib/discount/discount-ui.copy.ts` | UI strings (no hardcoded copy in components) |
| `lib/discount/discount-ui.utils.ts` | Hub tabs, summary cards, list filtering |
| `commerce/components/DiscountErrorBoundary.tsx` | Friendly error UI + retry |
| `commerce/screens/vendor/VendorDiscountScreen.tsx` | Vendor promotions hub (`/vendor/ads`) |
| `lib/store/hooks.ts` | `useAppDispatch`, `useAppSelector` |

Redux key: **`discount`** (registered in `lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Shop access checks | `~/lib/shop/shop.utils` (`canManageShop`, `isAdminRole`) |
| Buyer cart coupons | `~/commerce/lib/discounts.ts` (checkout apply flow) |
| Event-sourced discounts | `~/lib/sale-event/` (enrollment creates profiles; read via `loadEventDiscountsForShop`) |
| Currency formatting | `getCurrentShopUtils()` / `~/lib/format` |

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { DISCOUNT_FETCH_SCOPE } from '~/lib/discount/discount.constants'
import { loadShopDiscounts, createDiscountProfile } from '~/lib/discount/discount.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'

export function VendorDiscountsPanel({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const discounts = useAppSelector((s) => s.discount.discounts)
  const profile = useAppSelector((s) => s.profile.profile)

  useEffect(() => {
    dispatch(
      loadShopDiscounts({
        shopId,
        accessContext: { userId: profile?.id, role: profile?.role },
        scope: DISCOUNT_FETCH_SCOPE.VENDOR,
      }),
    )
  }, [dispatch, profile?.id, profile?.role, shopId])

  return (
    <Button
      onPress={() =>
        dispatch(
          createDiscountProfile({
            input: {
              shop_id: shopId,
              discount_name: 'Summer sale',
              discount_type: 'percentage',
              discount_value: 10,
              applies_to: 'order',
            },
            accessContext: { userId: profile?.id, role: profile?.role },
            scope: DISCOUNT_FETCH_SCOPE.VENDOR,
          }),
        )
      }
    >
      Create 10% off
    </Button>
  )
}
```

---

## 3. State shape

`useAppSelector((s) => s.discount.<field>)`

| Field | Meaning |
|-------|---------|
| `discounts` | Paginated shop discount list |
| `discountsById` | Indexed map for O(1) lookup |
| `currentDiscountId` | Selected discount detail |
| `listingDiscounts` | Discounts linked to a listing |
| `appliedDiscounts` | Order-item discount applications |
| `validationResult` | Last successful code validation |
| `previewResult` | Cart preview breakdown |
| `eventDiscounts` | Event-sourced profiles for the shop |
| `analytics` / `usageHistory` / `customerUsage` | Reporting |
| `filters` / `pagination` | List query state |
| `loading.*` | Per-operation flags |
| `error` | Last friendly error message |

---

## 4. Optimistic mutations

Rollback snapshots live outside Redux (keyed by thunk `requestId`).

Optimistic thunks: `createDiscountProfile`, `updateDiscountProfile`, `deleteDiscountProfile`,
`createBogoDiscount`, `updateBogoDiscount`, `bulkUpdateDiscountStatus`, `bulkDeleteDiscounts`,
`applyDiscountToOrderItem`.

---

## 5. Access context

Pass on vendor/admin writes:

```tsx
const accessContext = { userId: profile?.id, role: profile?.role }

dispatch(
  updateDiscountProfile({
    discountId,
    shopId,
    updates: { is_active: false },
    accessContext,
    scope: DISCOUNT_FETCH_SCOPE.VENDOR, // or ADMIN
  }),
)
```

Buyer flows (`validateDiscountCode`, `previewDiscountOnCart`, `loadCartEligibleDiscounts`) do not require shop management access.

---

## 6. Vendor UI route

| Route | Screen |
|-------|--------|
| `/vendor/ads` | `VendorDiscountScreen` — promotions list hub |
| `/vendor/ads/create` | `VendorCreateDiscountScreen` — full create flow (dynamic type/applies-to, BOGO, usage limits) |

Wrap feature panels with `DiscountErrorBoundary` and pass `onReset` to re-fetch.

---

## 7. Admin reuse

Admin dashboards should dispatch the same thunks with:

- `scope: DISCOUNT_FETCH_SCOPE.ADMIN`
- `accessContext.role` set to admin (`A`)

No separate admin service layer is required — RLS + `canManageShop` gate writes.

---

## 8. Related modules

- **Checkout coupons:** `commerce/lib/discounts.ts` — lightweight buyer apply/reconcile
- **Sale events:** `lib/sale-event/` — platform events that generate enrolled vendor discounts
- **Legacy vendor RPC:** `commerce/lib/vendor-operations.ts` `createVendorPromotion` — superseded by this module for new UI
