# Order Delivery & Tracking — Developer Guide

Everything for **delivery + shipment tracking** lives in **`lib/orders/`** and is
exposed through the same **Redux Toolkit** store used by vendor orders, payments,
issues and fulfilment. This is a sibling of the
[Vendor Orders guide](../vendor-orders/README.md) and builds on the **same shared
foundation** (`order.constants.ts`, `order.utils.ts`, `order.errors.ts`,
`order.access.ts`).

> **Scope** — Creating an `order_delivery` record (with a validated tracking
> number), advancing delivery status, vendor/admin delivery lists, tracking a
> shipment by number, and delivery analytics. It also powers the **Add Tracking
> Info** drawer that gates "Ready to Ship" on the vendor Orders page.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Delivery-status changes update the
> UI **optimistically** and roll back automatically if the server rejects them.
> All errors are already friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/orders/order.constants.ts` | **Shared** — plus delivery bits: `DELIVERY_STATUS`, `DELIVERY_MODE` (+ `DELIVERY_MODE_OPTIONS`), `DELIVERY_STATUS_DISPLAY`, `DELIVERY_STATUS_PROGRESS`. |
| `lib/orders/delivery.type.ts` | Types: `OrderDelivery` (row), `EnrichedDelivery` (joined), inputs (`CreateDeliveryInput`, `CreateTrackingInput`, `UpdateDeliveryStatusMetadata`), filters/pagination, `DeliveryAnalytics`. |
| `lib/orders/tracking.validation.ts` | **Courier catalog** (`COURIER_SLUGS`, `COURIER_RULES`, `COURIER_OPTIONS`) + tracking-number validation (`validateTrackingNumber`, `validateWithSuggestions`, `cleanTrackingNumber`, `getCourierName`, `getTrackingFormat`) + **Zod** (`deliverySchema`/`validateDeliveryData`, `trackingFormSchema`/`validateTrackingForm`). |
| `lib/orders/delivery.service.ts` | Typed Supabase data-access. You normally **don't** call these directly — dispatch thunks instead. |
| `lib/orders/delivery.store.ts` | Redux slice, async thunks, selectors. **This is your main entry point.** |
| `commerce/components/DeliveryErrorBoundary.tsx` | Error boundary that renders friendly delivery errors + a retry action. |
| `commerce/screens/vendor/VendorAddTrackingDrawer.tsx` | The **Add Tracking Info** right drawer (courier, tracking number, mode, dates, notify). |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`.** |

The slice is registered as **`delivery`** in the root store (`lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Response envelope + access | `order.access.ts` (`ok`/`fail`, `resolveUserId`, `isAdminUser`, `verifyVendorShopAccess`, `verifyOrderItemAccess`) |
| Friendly errors | `order.errors.ts` (`toFriendlyOrderError`) |
| Statuses / display / progress | `order.constants.ts` (`DELIVERY_STATUS`, `DELIVERY_STATUS_DISPLAY`, …) |
| Money / date formatting | `order.utils.ts` (`formatOrderAmount`, `formatOrderDate`) |

---

## 2. Access model (vendor **and** admin)

Same model as vendor orders:

- **Owner** — the user owns the shop the order item belongs to
  (`verifyOrderItemAccess` / `verifyVendorShopAccess`).
- **Admin** — `profiles.role === 'A'`; admins can operate on any shop and use the
  admin-only reads (`getTrackableDeliveries`, platform-wide analytics).

These checks are a UX convenience; **Supabase RLS is the real gate**. Pass an
explicit `userId` if you have it, otherwise the session user is used.

---

## 3. The "Add tracking" flow (courier-driven status)

Vendors never manually set In Transit / Out for Delivery / Delivered. They
**select a courier, then enter the AWB**. Status advances from courier feeds:

```
Add tracking  ──▶  select courier → enter AWB  ──▶  createTracking (order_delivery = shipped)
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    ▼                                 ▼                                 ▼
         sync_order_item_status            notify_delivery_status_change      courier-track-sync
         (item → shipped)                  (buyer templates if notify on)     (direct courier APIs +
                                                                              SHEDelivery webhooks)
                                                                              → in_transit → OFD → delivered
```

Providers (auto status for any courier the vendor picks):
1. **Direct courier API** when available (Delhivery, DTDC, Xpressbees, BlueDart, Ecom Express, Shiprocket)
2. **AfterShip** (`AFTERSHIP_API_KEY`) — covers most couriers worldwide
3. **TrackingMore** (`TRACKINGMORE_API_KEY`) — fallback aggregator
4. Always stores a **public courier track URL** for the buyer

Status changes notify **customer and vendor** via `notify_delivery_status_change`
(templates seeded in `20260812122000_delivery_notify_customer_and_vendor.sql`).

**Model:** vendors book and dispatch themselves (no managed SHEDelivery). SHEPay uses PayU split — **0% SHEconomy commission**.

Optional direct secrets: `DELHIVERY_API_TOKEN`, `DTDC_API_KEY`, `XPRESSBEES_TOKEN`, BlueDart / Ecom Express keys.

If the vendor cancels the drawer without saving, **nothing changes**.

```tsx
// In VendorOrdersScreen: intercept the shipped transition.
const handleAdvance = (item, target) => {
  if (target === ORDER_STATUS.SHIPPED) {
    setTrackingItem(item) // open the drawer instead of dispatching
    return
  }
  dispatch(updateOrderItemStatus({ orderItemId: item.id, newStatus: target }))
}
```

---

## 4. The 30-second version

```tsx
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  createTracking,
  loadVendorDeliveries,
  selectVendorDeliveries,
  selectDeliveryLoading,
} from '~/lib/orders/delivery.store'

const dispatch = useAppDispatch()
const deliveries = useAppSelector(selectVendorDeliveries)
const loading = useAppSelector(selectDeliveryLoading)

// Add tracking (also marks the item shipped via the DB trigger):
await dispatch(
  createTracking({
    input: {
      order_id: item.order_id,
      order_item_id: item.id,
      courier_slug: 'dtdc',
      tracking_number: 'DT1234567890',
      delivery_mode: 'standard',
      delivery_address: item.billing_address,
      notify_customer: true,
    },
  }),
).unwrap()

// Vendor delivery list:
dispatch(loadVendorDeliveries({ vendorId: shopId, options: { page: 1, limit: 20 } }))
```

---

## 5. Thunks (dispatch these)

| Thunk | Args | Purpose |
|-------|------|---------|
| `createTracking` | `{ input: CreateTrackingInput, userId? }` | **Validate** the tracking number against its courier, then create the `order_delivery` record (status `shipped`). |
| `createDelivery` | `{ input: CreateDeliveryInput, userId? }` | Low-level create when you already have all delivery fields. |
| `updateDeliveryStatus` | `{ deliveryId, status, metadata?, userId? }` | **Optimistic** delivery-status change (adds status-specific timestamps/metadata). |
| `loadOrderDeliveries` | `{ orderItemId, userId? }` | Deliveries for one order item. |
| `trackDelivery` | `{ trackingNumber, userId? }` | Look up a shipment by tracking number. |
| `loadVendorDeliveries` | `{ vendorId, options?, userId? }` | Paginated deliveries for a shop (owner/admin). |
| `loadTrackableDeliveries` | `{ options?, userId? }` | **Admin only** — in-flight shipments with a tracking number. |
| `loadDeliveryAnalytics` | `{ filters?, userId? }` | Vendor-scoped (`filters.vendor_id`) or admin-wide delivery analytics. |

`CreateTrackingInput` fields: `order_id`, `order_item_id?`, `tracking_number`,
`courier_slug`, `delivery_mode?`, `shipping_date?`, `estimated_delivery_date?`,
`note?` (internal), `custom_tracking_url?`, `delivery_address?`,
`notify_customer?`.

---

## 6. Selectors

| Selector | Returns |
|----------|---------|
| `selectCurrentDelivery` | The most recently created/updated delivery. |
| `selectOrderDeliveries` | Deliveries loaded for an order item. |
| `selectVendorDeliveries` | Paginated deliveries for a shop. |
| `selectVendorDeliveriesPagination` | `{ page, limit, total, total_pages }`. |
| `selectTrackableDeliveries` | In-flight shipments (admin). |
| `selectTrackingInfo` | Result of `trackDelivery`. |
| `selectDeliveryAnalytics` | Analytics (status/carrier breakdowns, on-time rate, avg days). |
| `selectDeliveryLoading` | Per-action loading flags (`creating`, `updatingStatus`, …). |
| `selectDeliveryError` | Friendly error string (or `null`). |

Sync actions: `clearError`, `resetDeliveryStore`.

---

## 7. Validation & the courier catalog

- **Tracking numbers** are validated per courier via `COURIER_RULES` (regex
  patterns + a human hint + example formats). Use `validateTrackingNumber` for a
  boolean+message, or `validateWithSuggestions` to also get correction tips.
- `cleanTrackingNumber` strips spaces/hyphens and upper-cases before validating.
- `getCourierName(slug)` / `getTrackingFormat(slug)` back the courier dropdown and
  the "Formatting Tips" banner in the drawer.
- `validateDeliveryData` (Zod) mirrors the legacy rule set: an order id (or item
  id) and a delivery address are required; a tracking number, if present, must be
  ≥ 5 characters.

No courier data is hard-coded at call sites — it all lives in
`tracking.validation.ts`.

---

## 8. Optimistic updates & rollback

`updateDeliveryStatus` applies the new `delivery_status` to
`orderDeliveries`, `vendorDeliveries` and `currentDelivery` **immediately** (in
the `pending` phase), snapshotting the previous state. On `fulfilled` the server
row is merged; on `rejected` the snapshot is restored and `state.error` is set to
a friendly message — exactly like the vendor-orders slice.

---

## 9. Automatic status sync (important)

The database owns cross-status consistency. `order_delivery` has **two** triggers
(migration `022`):

- `trigger_sync_order_item_status_from_delivery_insert` — **AFTER INSERT**
- `trigger_sync_order_item_status_from_delivery` — **AFTER UPDATE** of
  `delivery_status`

Both run `sync_order_item_status_from_delivery`, which maps the delivery status to
the order-item status (`shipped → shipped`, `delivered → delivered`,
`failed_delivery → on_hold`, …) for **all items of that order**, which in turn
fires `sync_order_status_from_items` for the parent order.

**Consequence:** the service never manually advances the order item after creating
a delivery — inserting the `order_delivery` row with `delivery_status = 'shipped'`
is what marks the item shipped. This is why the drawer's `createTracking` is the
single source of truth for shipping.

---

## 10. Errors & the boundary

All service errors are mapped by `toFriendlyOrderError`, so toasts/banners show
human text. Wrap delivery surfaces with the boundary to catch render-time errors:

```tsx
import { DeliveryErrorBoundary } from '~/commerce/components/DeliveryErrorBoundary'

<DeliveryErrorBoundary scope="AddTracking">
  <VendorAddTrackingDrawer … />
</DeliveryErrorBoundary>
```

---

## 11. Notes

- **Courier sync** — direct courier APIs first, then **AfterShip** / **TrackingMore**
  for any other carrier. Cron every 20 minutes; also invoked after `createTracking`.
- **Fulfillment model** — vendors book and dispatch; paste AWB on Orders. No managed
  SHEDelivery booking.
- **Payments** — SHEPay = PayU split to vendor child MID; **0% SHEconomy commission**.
- **Secrets** — set `AFTERSHIP_API_KEY` (recommended) and/or `TRACKINGMORE_API_KEY`;
  optional per-courier tokens (`DELHIVERY_*`, `DTDC_*`, etc.).
- **Schema folding** — location / notes / failure details live in
  `delivery_metadata` JSON.
- **Foundation is shared** — delivery reuses `order.constants.ts`,
  `order.utils.ts`, `order.errors.ts` and `order.access.ts`.
