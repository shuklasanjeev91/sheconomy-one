# Fulfillment & Logistics — Developer Guide

Everything for **order fulfillment / logistics** lives in **`lib/orders/`**
(alongside vendor orders, payments and issues) and is exposed through the same
**Redux Toolkit** store. This guide is for UI developers building **vendor**
(pick/pack/ship their items) or **admin** (all fulfillments + analytics)
surfaces.

> **Scope** — This covers the `order_fulfillments`, `fulfillment_events` and
> `carrier_services` tables. It **reuses** the shared orders foundation
> (`order.constants.ts`, `order.errors.ts`, `order.access.ts`).

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, dispatch
> thunks. Status changes update the UI **optimistically** and roll back if the
> server rejects them. All errors are already friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/orders/fulfillment.type.ts` | Types: `Fulfillment` / `EnrichedFulfillment` (row + joins), `FulfillmentEvent`, `CarrierService`, inputs, filters, analytics, stats. |
| `lib/orders/fulfillment.validation.ts` | **Zod** `fulfillmentSchema` + `validateFulfillmentData()` and `carrierSchema` + `validateCarrierData()` (migrated from `validators.js`). |
| `lib/orders/fulfillment.service.ts` | Typed Supabase data-access. Dispatch thunks instead of calling directly. |
| `lib/orders/fulfillment.store.ts` | Redux slice, async thunks, selectors. **Main entry point.** |
| `commerce/components/FulfillmentErrorBoundary.tsx` | Error boundary that renders friendly fulfillment errors + retry. |
| `lib/orders/order.constants.ts` | Shared `FULFILLMENT_STATUS`, `FULFILLMENT_EVENT_TYPE`, `FULFILLMENT_DEFAULTS` + status groups. |
| `lib/orders/order.errors.ts` | Shared `toFriendlyOrderError()` (reused for fulfillment). |

The slice is registered as **`fulfillment`** in the root store (`lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Response envelope / access | `lib/orders/order.access.ts` (`ok`/`fail`, `resolveUserId`, `isAdminUser`, `verifyVendorShopAccess`, `verifyOrderItemAccess`) |
| Status / event-type values | `lib/orders/order.constants.ts` |
| Friendly errors | `lib/orders/order.errors.ts` |

---

## 2. Schema note (important)

`fulfillment_status` is **enum-backed** (`fulfillment_status_enum`), so the modern
lifecycle replaces the legacy picking/packing sub-states:

```
pending → processing → ready_to_ship → shipped → out_for_delivery → delivered
                                    ↘ delivery_failed / exception / returned / returned_to_sender / cancelled
```

Legacy fields are mapped or folded as follows:

| Legacy field | Now |
|--------------|-----|
| `package_weight` | `package_weight_grams` |
| `package_dimensions` | `package_dimensions_cm` |
| `service_code` | `carrier_service_code` |
| `priority_level` (`'normal'`) | numeric `priority_level` (default `FULFILLMENT_DEFAULTS.PRIORITY_LEVEL`) |
| `picking_started_at` / `picked_at` / `packing_started_at` / `packed_at` / `ready_to_ship_at` | **dropped** (no columns in the modern lifecycle) |
| `exception_reason` | `last_failure_reason` (+ `last_failure_at`) |
| `cancelled_at` / `cancellation_reason`, `tracking_url`, `third_party_logistics_provider` | folded into `fulfillment_metadata` (merged, never overwritten) |

`fulfillment_number` is **required** and auto-generated (`FUL-<ts>-<rand>`) when
the caller omits it.

---

## 3. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  fetchVendorFulfillments,
  updateFulfillmentStatus,
  selectFulfillments,
} from '~/lib/orders/fulfillment.store'
import { FULFILLMENT_STATUS } from '~/lib/orders/order.constants'

export function VendorFulfillmentsScreen({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const fulfillments = useAppSelector(selectFulfillments)

  useEffect(() => {
    dispatch(fetchVendorFulfillments({ vendorId: shopId }))
  }, [dispatch, shopId])

  const ship = (id: string, trackingNumber: string) =>
    dispatch(updateFulfillmentStatus({
      fulfillmentId: id,
      status: FULFILLMENT_STATUS.SHIPPED,
      metadata: { tracking_number: trackingNumber, quantity_shipped: 1 },
    }))
}
```

---

## 4. Thunks (dispatch these)

| Thunk | Args | Purpose |
|-------|------|---------|
| `fetchVendorFulfillments` | `{ vendorId, options?, userId? }` | Fulfillments for a vendor shop's items (owner/admin). |
| `fetchFulfillmentDetails` | `{ fulfillmentId, userId? }` | Full detail incl. order item, order and event timeline. |
| `createFulfillment` | `{ input, userId? }` | Create a fulfillment record (validated) + logs the initial event. Prepends on success. |
| `updateFulfillmentStatus` | `{ fulfillmentId, status, metadata?, userId? }` | **Optimistic** status change; applies status-specific fields + logs a status-change event. |
| `createFulfillmentEvent` | `{ fulfillmentId, eventData }` | Append a timeline event (carrier scan, delivery attempt, …). |
| `trackFulfillment` | `{ trackingNumber, userId? }` | Look up a fulfillment by carrier tracking number. |
| `fetchCarrierServices` | `{ filters?, userId? }` | Active carrier services (optionally international only). |
| `fetchFulfillmentAnalytics` | `{ filters?, userId? }` | Totals, breakdowns, on-time rates, avg fulfillment time. Vendor-scoped or admin-wide. |
| `fetchAllFulfillments` | `{ options?, userId? }` | **Admin only** — every fulfillment on the platform. |

`options` (`FulfillmentQueryOptions`): `page`, `limit`, `status`, `carrier_code`,
`fulfillment_center_id`, `priority_level`, `sort_by`, `sort_order`.

`updateFulfillmentStatus` `metadata` (`UpdateFulfillmentStatusMetadata`) — used
per target status: `tracking_number`, `tracking_url`, `quantity_shipped`,
`shipping_cost`, `insurance_cost`, `package_weight_grams`,
`package_dimensions_cm`, `shipping_label_url`, `quantity_delivered`,
`exception_reason`, `next_retry_at`, `return_reason`, `quantity_returned`,
`cancellation_reason`, plus `updated_by` / `source_system` for the event.

---

## 5. Selectors

| Selector | Returns |
|----------|---------|
| `selectFulfillments` | Loaded fulfillments. |
| `selectCurrentFulfillment` | Fulfillment opened in detail / tracking view. |
| `selectFulfillmentEvents` | Event timeline for the current fulfillment. |
| `selectCarrierServices` | Loaded carrier services. |
| `selectFulfillmentLoading` | Per-action loading flags. |
| `selectFulfillmentError` | Friendly error string (or `null`). |
| `selectFulfillmentsPagination` | Pagination meta. |
| `selectFulfillmentAnalytics` | Analytics data. |
| `selectAdminFulfillments` | Platform-wide fulfillments (admin). |
| `selectPendingFulfillments` / `selectOverdueFulfillments` | Derived lists. |
| `selectFulfillmentsByStatus(status)` / `selectFulfillmentsByPriority(priority)` | Parameterised filters. |
| `selectFulfillmentStats` | Client-side counts (`total`, `pending`, `shipped`, `delivered`, `cancelled`, `overdue`). |

Sync actions: `setFulfillmentFilters`, `setCurrentFulfillment`, `clearError`, `resetFulfillments`.

---

## 6. Optimistic updates, access & errors

- **Optimistic** — `updateFulfillmentStatus` applies the new status immediately
  and rolls back on failure (snapshot registry). Create is prepended on success.
- **Access** — vendors manage their shop's fulfillments (`verifyVendorShopAccess`
  for lists, `verifyOrderItemAccess` for create/status-change); admins access
  everything. Analytics is vendor-scoped or admin-gated; `fetchAllFulfillments`
  is admin-only. RLS is the real gate.
- **Events** — `createFulfillment` and `updateFulfillmentStatus` automatically
  append `status_change` events, mirroring the legacy service.
- **Errors** — mapped by `toFriendlyOrderError`. Wrap fulfillment screens:

```tsx
import { FulfillmentErrorBoundary } from '~/commerce/components/FulfillmentErrorBoundary'

<FulfillmentErrorBoundary scope="Fulfillments" onReset={() => dispatch(fetchVendorFulfillments({ vendorId }))}>
  <VendorFulfillmentsScreen shopId={vendorId} />
</FulfillmentErrorBoundary>
```

Note: the legacy `logger`/`console` noise was not migrated (we reuse the shared
`toFriendlyOrderError`). Carrier validation (`validateCarrierData`) is migrated
and ready for a future carrier-management surface.
