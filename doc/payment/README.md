# Order Payments — Developer Guide

Everything for **order payment management** lives in **`lib/orders/`** (alongside
the vendor orders module) and is exposed through the same **Redux Toolkit**
store used by profiles, shops, listings and vendor orders. This guide is for UI
developers building **checkout**, **vendor** (COD collection / status) or
**admin** (payment analytics) surfaces.

> **Scope** — This covers the `order_payments` table only. It's part of the
> broader orders migration and **reuses** the shared foundation introduced with
> vendor orders (`order.constants.ts`, `order.errors.ts`, `order.access.ts`).

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Status changes and COD collection
> update the UI **optimistically** and roll back automatically if the server
> rejects them. All errors are already turned into friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/orders/payment.type.ts` | Types: `OrderPayment` (row), `ProcessPaymentInput`, `CODCollectionInput`, `PaymentAnalytics`, filters. Re-exports the shared `OrderServiceResponse`. |
| `lib/orders/payment.validation.ts` | **Zod** `paymentSchema` + `validatePaymentData()` (migrated from `validators.js`). |
| `lib/orders/payment.service.ts` | Typed Supabase data-access (`processPayment`, `updatePaymentStatus`, `collectCODPayment`, `getOrderPayments`, `getPaymentAnalytics`). Dispatch thunks instead of calling directly. |
| `lib/orders/payment.store.ts` | Redux slice, async thunks, selectors. **This is your main entry point.** |
| `commerce/components/PaymentErrorBoundary.tsx` | Error boundary that renders friendly payment errors + a retry action. |
| `lib/orders/order.constants.ts` | Shared `PAYMENT_STATUS` / `PAYMENT_MODE` (aligned to the Supabase enums). |
| `lib/orders/order.errors.ts` | Shared `toFriendlyOrderError()` (reused for payments). |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`.** |

The slice is registered as **`payment`** in the root store (`lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Response envelope / access | `lib/orders/order.access.ts` (`ok`/`fail`, `resolveUserId`, `isAdminUser`) |
| Status / mode constants | `lib/orders/order.constants.ts` (`PAYMENT_STATUS`, `PAYMENT_MODE`) |
| Friendly errors | `lib/orders/order.errors.ts` (`toFriendlyOrderError`) |

---

## 2. Schema note (important)

The modern `order_payments` table **doesn't** have the legacy bespoke columns
(`gateway_response`, `failed_at`, `refunded_at`, `refund_amount`,
`cod_receipt_number`, `payment_notes`). Those values are folded into the
`payment_metadata` JSON blob (merged, never clobbered), so nothing is lost:

| Legacy column | Now stored as |
|---------------|---------------|
| `gateway_response` | `payment_metadata.gateway_response` |
| `refund_amount` / `refunded_at` | `payment_metadata.refund_amount` / `.refunded_at` |
| `cod_receipt_number` | `payment_metadata.cod_receipt_number` |
| `payment_notes` | `payment_metadata.payment_notes` |
| `failure_reason` | `failure_reason` (native column) |
| `failure_code` | `failure_code` (native column) |

---

## 3. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  getOrderPayments,
  updatePaymentStatus,
  selectOrderPayments,
  selectPaymentLoading,
} from '~/lib/orders/payment.store'
import { PAYMENT_STATUS } from '~/lib/orders/order.constants'

export function OrderPaymentsPanel({ orderId }: { orderId: string }) {
  const dispatch = useAppDispatch()
  const payments = useAppSelector(selectOrderPayments)
  const loading = useAppSelector(selectPaymentLoading)

  useEffect(() => {
    dispatch(getOrderPayments({ orderId }))
  }, [dispatch, orderId])

  const markCompleted = (paymentId: string) =>
    dispatch(updatePaymentStatus({ paymentId, status: PAYMENT_STATUS.COMPLETED }))
}
```

---

## 4. Thunks (dispatch these)

| Thunk | Args | Purpose |
|-------|------|---------|
| `processPayment` | `{ input, userId? }` | Mark an order's payment as **processing** and attach gateway details. Validates with `paymentSchema`. |
| `updatePaymentStatus` | `{ paymentId, status, metadata?, userId? }` | **Optimistic** status change (adds `processed_at` / `failure_*` / refund metadata by status). |
| `collectCODPayment` | `{ orderId, collection?, userId? }` | **Optimistic** COD collection — sets the COD payment to `completed` with collector/receipt info. |
| `getOrderPayments` | `{ orderId, userId? }` | All payment rows for an order, newest first. |
| `getPaymentAnalytics` | `{ filters?, userId? }` | **Admin only** — totals, per-mode/status breakdowns, success rate. |

`ProcessPaymentInput`: `{ order_id, payment_mode, amount, transaction_id?, payment_gateway?, gateway_response? }`.
`CODCollectionInput`: `{ collected_by?, amount?, receipt_number?, notes? }`.

---

## 5. Selectors

| Selector | Returns |
|----------|---------|
| `selectCurrentPayment` | The most recently processed payment. |
| `selectOrderPayments` | Payment rows for the loaded order. |
| `selectPaymentAnalytics` | Admin analytics data. |
| `selectPaymentLoading` | Per-action loading flags (`processing`, `updatingStatus`, `loadingPayments`, `collectingCOD`, `loadingAnalytics`). |
| `selectPaymentError` | Friendly error string (or `null`). |

Sync actions: `clearError`, `resetPaymentStore`.

---

## 6. Optimistic updates & rollback

`updatePaymentStatus` and `collectCODPayment` apply the change to the store
**immediately** (in the thunk's `pending` phase), snapshotting the previous
state in an internal registry. On `fulfilled` the server row is merged in; on
`rejected` the snapshot is restored and `state.error` is set to a friendly
message. No manual optimistic wiring in components — just dispatch and render.

---

## 7. Access model

- **Mutations** (`processPayment`, `updatePaymentStatus`, `collectCODPayment`)
  and **reads** (`getOrderPayments`) require an **authenticated** user; the row
  itself is protected by **Supabase RLS**.
- **`getPaymentAnalytics`** is **admin-gated** (`isAdminUser`) since it
  aggregates across all payments; non-admins get a friendly
  "Access denied for admin operations".

Pass an explicit `userId` if you already have it, otherwise the session user is
used automatically.

---

## 8. Errors & the boundary

All service errors are mapped by `toFriendlyOrderError` so toasts/banners show
human text, never a Postgres code. Wrap payment/checkout screens with the
boundary to catch render-time errors too:

```tsx
import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'

<PaymentErrorBoundary scope="Checkout" onReset={() => dispatch(getOrderPayments({ orderId }))}>
  <OrderPaymentsPanel orderId={orderId} />
</PaymentErrorBoundary>
```

---

## 9. Notes / deferrals

- **Logger not migrated** — the legacy service's `console`/log noise was left out.
- **`payment_metadata` is merged**, never overwritten, so repeated updates keep
  earlier gateway / COD details.
- **Shared foundation** — payments reuse the same `order.*` foundation as vendor
  orders; future order modules (refunds, fulfilment) build on it too.
