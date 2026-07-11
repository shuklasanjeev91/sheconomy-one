# Vendor Orders — Developer Guide

Everything for **vendor-facing order management** lives in **`lib/orders/`** and
is exposed through the same **Redux Toolkit** store used by profiles, shops and
listings. This guide is for UI developers building the **vendor dashboard**
(view / update / fulfil orders) or the **admin dashboard** (platform-wide
oversight).

> **Scope** — This is the **vendor** order surface (order *items* the seller is
> responsible for). Customer/buyer order flows and the rest of
> `lib/services/shared/orders` are migrated later **on top of the shared
> foundation** introduced here (`order.constants.ts`, `order.utils.ts`,
> `order.errors.ts`, `order.access.ts`).

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Status changes update the UI
> **optimistically** and roll back automatically if the server rejects them.
> All errors are already turned into friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/orders/order.constants.ts` | **Shared** enums/unions aligned to Supabase (`OrderStatus`, `PaymentMode`, `DeliveryStatus`), the `VALID_STATUS_TRANSITIONS` state machine, status display/progress maps, defaults. |
| `lib/orders/order.utils.ts` | **Shared** pure helpers: `formatOrderAmount`, `formatOrderDate`, `getOrderStatusDisplay`, `getOrderProgress`, `getNextPossibleStatuses`, `isValidStatusTransition`, `validateStatusTransition` (role-aware). |
| `lib/orders/order.errors.ts` | **Centralised order error handling** — `OrderError`, `ORDER_ERROR_CODES`, `toFriendlyOrderError()`. |
| `lib/orders/order.access.ts` | Response envelope (`ok`/`fail`) + access helpers (`resolveUserId`, `isAdminUser`, `verifyVendorShopAccess`, `verifyOrderItemAccess`). |
| `lib/orders/vendor-orders.type.ts` | Types: `OrderItem`, `VendorOrderItem` (enriched), filters/pagination, analytics/summary/stats shapes, update payloads. |
| `lib/orders/vendor-orders.validation.ts` | **Zod** schemas (`itemStatusUpdateSchema`, `bulkStatusUpdateSchema`, `vendorItemFieldsUpdateSchema`, filters) + `validate…` helpers. |
| `lib/orders/vendor-orders.utils.ts` | Vendor-specific transforms (`transformVendorOrderItem`) + client-side aggregations (`computeVendorOrderStats`, `getPendingVendorOrders`, …). Re-exports the shared status helpers. |
| `lib/orders/vendor-orders.service.ts` | Typed Supabase data-access. You normally **don't** call these directly — dispatch thunks instead. |
| `lib/orders/vendor-orders.store.ts` | Redux slice, async thunks, selectors. **This is your main entry point.** |
| `commerce/components/VendorOrderErrorBoundary.tsx` | Error boundary that renders friendly order errors + a retry action. |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`.** |

The slice is registered as **`vendorOrders`** in the root store
(`lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Currency formatting | `~/lib/format` (`formatCurrency`) |
| Roles / admin check | `~/lib/profile/profile.type` (`USER_ROLES`) + `profiles.role` |
| Friendly errors | `lib/orders/order.errors.ts` |
| Auth / user id | `supabase.auth.getUser()` via `resolveUserId` |

---

## 2. Access model (vendor **and** admin)

Every service function resolves the acting user and checks access before
touching data:

- **Owner** — the user owns the shop (`shops.user_id`) the order item belongs to.
- **Admin** — the user's `profiles.role === 'A'`; admins can operate on **any**
  shop's orders and use the platform-wide admin reads.

These checks are a UX convenience; **Supabase RLS is the real gate**. Pass an
explicit `userId` to any function/thunk if you already have it, otherwise the
session user is used automatically.

---

## 3. The 30-second version (vendor dashboard)

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadVendorOrders,
  updateOrderItemStatus,
  selectVendorOrders,
  selectVendorOrdersLoading,
} from '~/lib/orders/vendor-orders.store'
import { ORDER_STATUS } from '~/lib/orders/order.constants'

export function VendorOrdersScreen({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const orders = useAppSelector(selectVendorOrders)
  const loading = useAppSelector(selectVendorOrdersLoading)

  useEffect(() => {
    dispatch(loadVendorOrders({ vendorId: shopId }))
  }, [dispatch, shopId])

  const markShipped = (orderItemId: string) =>
    dispatch(updateOrderItemStatus({ orderItemId, newStatus: ORDER_STATUS.SHIPPED }))

  // orders are already normalised: item.listing.main_image_url,
  // item.shipping_address and item.billing_address are ready to render.
}
```

---

## 4. Thunks (dispatch these)

| Thunk | Args | Purpose |
|-------|------|---------|
| `loadVendorOrders` | `{ vendorId, filters?, pagination?, userId? }` | Paginated, filterable order items for a shop. |
| `loadVendorOrderItem` | `{ orderItemId, userId? }` | Full detail for one item (addresses, customer, status logs). |
| `updateOrderItemStatus` | `{ orderItemId, newStatus, note?, userId? }` | **Optimistic** single status change. |
| `bulkUpdateOrderItemStatus` | `{ orderItemIds, newStatus, note?, userId? }` | **Optimistic** bulk status change. |
| `updateVendorOrderItem` | `{ orderItemId, updates, userId? }` | **Optimistic** update of vendor-editable fields. |
| `loadVendorAnalytics` | `{ vendorId, filters?, userId? }` | Revenue / counts / status distribution over a window. |
| `loadVendorSummary` | `{ vendorId, options?, userId? }` | Dashboard summary: metrics, distributions, top products, recent orders. |
| `searchVendorOrders` | `{ vendorId, params?, userId? }` | Search a shop's items (query, amount range, dates, status). |
| `loadAdminOrders` | `{ params?, userId? }` | **Admin only** — order items across all vendors. |
| `loadPlatformAnalytics` | `{ filters?, userId? }` | **Admin only** — analytics across all vendors. |

Vendor-editable fields (`updateVendorOrderItem.updates`): `item_status`,
`digital_download_url`, `download_expires_at`. Anything else is ignored.

---

## 5. Selectors

| Selector | Returns |
|----------|---------|
| `selectVendorOrders` | Loaded order items (normalised). |
| `selectCurrentVendorOrderItem` | The item opened in detail view. |
| `selectVendorOrdersLoading` | Per-action loading flags. |
| `selectVendorOrdersError` | Friendly error string (or `null`). |
| `selectVendorPagination` | `{ page, limit, total, total_pages }`. |
| `selectVendorAnalytics` / `selectVendorSummary` | Dashboard data. |
| `selectAdminOrders` | Platform-wide items (admin). |
| `selectVendorOrderStats` | Client-side counts by status (`total`, `pending`, …). |
| `selectPendingVendorOrders` / `selectRecentVendorOrders` | Derived lists. |
| `selectVendorLoadedRevenue` | Sum of `total_price` over loaded items. |

Sync actions: `setVendorFilters`, `clearError`, `clearSearchResults`,
`clearVendorData`.

---

## 6. Optimistic updates & rollback

`updateOrderItemStatus`, `bulkUpdateOrderItemStatus` and `updateVendorOrderItem`
apply the change to the store **immediately** (in the thunk's `pending` phase),
snapshotting the previous state in an internal registry. On `fulfilled` the
server row is merged in; on `rejected` the snapshot is restored and
`state.error` is set to a friendly message. No manual optimistic wiring needed
in components — just dispatch and render.

**Status transitions are validated twice**: client-side against the state
machine (`validateStatusTransition`, role-aware) and server-side before the
write. Admins get the override targets (`cancelled`, `refunded`, `on_hold`).

---

## 7. Automatic order-status sync (important)

The database owns cross-item consistency. The trigger
`sync_order_status_from_items` (migration `022`) automatically:

1. sets `orders.order_status` when **all** items of an order share one status, and
2. writes a `system_generated` row into `order_status_logs`.

So the service **only** updates the item and adds an optional item-level audit
note — it never manually writes the parent order status (the legacy
`checkAndUpdateMainOrderStatus` is intentionally dropped as redundant). There's
also `sync_order_item_status_from_delivery`, which moves item statuses when a
delivery's `delivery_status` changes.

---

## 8. Errors & the boundary

All service errors are mapped by `toFriendlyOrderError` (see `ORDER_ERROR_CODES`)
so toasts/banners show human text, never a Postgres code. Wrap order screens
with the boundary to catch render-time errors too:

```tsx
import { VendorOrderErrorBoundary } from '~/commerce/components/VendorOrderErrorBoundary'

<VendorOrderErrorBoundary scope="VendorOrders" onReset={() => dispatch(loadVendorOrders({ vendorId }))}>
  <VendorOrdersScreen shopId={shopId} />
</VendorOrderErrorBoundary>
```

---

## 9. Admin dashboard usage

```tsx
import { loadAdminOrders, loadPlatformAnalytics, selectAdminOrders } from '~/lib/orders/vendor-orders.store'

dispatch(loadAdminOrders({ params: { status: ORDER_STATUS.DISPUTED, page: 1, limit: 50 } }))
dispatch(loadPlatformAnalytics({ filters: { date_from, date_to } }))
const rows = useAppSelector(selectAdminOrders)
```

Both admin thunks are **role-gated** in the service (`isAdminUser`) and will
reject with a friendly "Access denied for admin operations" for non-admins.

---

## 10. Notes / deferrals

- **Logger not migrated** — the legacy service's `logger`/`console` noise was
  intentionally left out.
- **Vendor notes** — the legacy `vendor_notes` field has no column in the new
  `order_items` schema, so it's not part of the editable allow-list.
- **Foundation is shared** — `order.constants.ts`, `order.utils.ts`,
  `order.errors.ts` and `order.access.ts` are deliberately generic so the
  upcoming customer/fulfilment/refund migrations build on them without
  duplication.
