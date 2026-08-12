# Order Issues & Disputes — Developer Guide

Everything for **order issue / dispute management** lives in **`lib/orders/`**
(alongside vendor orders and payments) and is exposed through the same **Redux
Toolkit** store. This guide is for UI developers building **customer** (report /
track issues), **vendor** (issues on their items) or **admin** (all issues +
analytics) surfaces.

> **Scope** — This covers the `order_issues` table. It **reuses** the shared
> orders foundation (`order.constants.ts`, `order.errors.ts`, `order.access.ts`).

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, dispatch
> thunks. Status changes update the UI **optimistically** and roll back if the
> server rejects them. All errors are already friendly messages.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/orders/order-issue.type.ts` | Types: `OrderIssue` (row), `EnrichedOrderIssue` (joined), inputs, filters, analytics, stats. |
| `lib/orders/order-issue.validation.ts` | **Zod** `orderIssueSchema` + `validateOrderIssueData()` (migrated from `validators.js`) + status/type/priority schemas. |
| `lib/orders/order-issue.service.ts` | Typed Supabase data-access. Dispatch thunks instead of calling directly. |
| `lib/orders/order-issue.store.ts` | Redux slice, async thunks, selectors. **Main entry point.** |
| `commerce/components/OrderIssueErrorBoundary.tsx` | Error boundary that renders friendly issue errors + retry. |
| `lib/orders/order.constants.ts` | Shared `ISSUE_STATUS`, `ORDER_ISSUE_TYPE`, `ISSUE_PRIORITY` + status groups. |
| `lib/orders/order.errors.ts` | Shared `toFriendlyOrderError()` (reused for issues). |

The slice is registered as **`orderIssues`** in the root store (`lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Response envelope / access | `lib/orders/order.access.ts` (`ok`/`fail`, `resolveUserId`, `isAdminUser`, `verifyVendorShopAccess`) |
| Status / type / priority values | `lib/orders/order.constants.ts` |
| Friendly errors | `lib/orders/order.errors.ts` |

---

## 2. Schema note (important)

The modern `order_issues` table is leaner than the legacy one. Legacy fields are
mapped or dropped as follows:

| Legacy field | Now |
|--------------|-----|
| `subject` | `issue_title` (required) |
| `priority` | `issue_priority` |
| `attachments` | `evidence_urls` (`string[]`) |
| `contact_information` | **dropped** (no column) |
| `admin_notes` / comments | **deferred** — no column/table (see §7) |
| `resolved_by`, `assigned_at`, `closed_by`, `closure_reason`, `escalation_*` | folded into `assigned_to` / `resolved_at` / `resolution_note` / `closed_at` |

`issue_type`, `issue_priority` and `status` are plain strings in the DB — the
canonical value sets live in `order.constants.ts`.

---

## 3. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  fetchUserIssues,
  createOrderIssue,
  selectOrderIssues,
} from '~/lib/orders/order-issue.store'
import { ORDER_ISSUE_TYPE } from '~/lib/orders/order.constants'

export function MyIssuesScreen() {
  const dispatch = useAppDispatch()
  const issues = useAppSelector(selectOrderIssues)

  useEffect(() => {
    dispatch(fetchUserIssues()) // defaults to the signed-in user
  }, [dispatch])

  const report = (orderId: string) =>
    dispatch(createOrderIssue({
      input: {
        order_id: orderId,
        issue_type: ORDER_ISSUE_TYPE.DAMAGED_ITEM,
        subject: 'Item arrived damaged',
        description: 'The box was crushed and the item is cracked.',
      },
    }))
}
```

---

## 4. Thunks (dispatch these)

| Thunk | Args | Purpose |
|-------|------|---------|
| `fetchUserIssues` | `{ targetUserId?, options?, userId? }` | Issues reported by a user (defaults to session user; admins can query others). |
| `fetchVendorIssues` | `{ vendorId, options?, userId? }` | Issues raised against a vendor shop's items (owner/admin). |
| `fetchIssueDetails` | `{ issueId, userId? }` | Full detail incl. order, item, shop, and profile joins. |
| `createOrderIssue` | `{ input, userId? }` | Create a new issue (validated with `orderIssueSchema`). Prepends on success. |
| `updateIssueStatus` | `{ issueId, status, metadata?, userId? }` | **Optimistic** status change (adds `resolved_at`/`closed_at`/`assigned_to` by status). |
| `fetchIssueAnalytics` | `{ filters?, userId? }` | Totals, breakdowns, resolution rate/time. Vendor-scoped (`filters.vendor_id`) or admin-wide. |
| `fetchAllIssues` | `{ options?, userId? }` | **Admin only** — every issue on the platform. |

`options` (`OrderIssueQueryOptions`): `page`, `limit`, `status`, `issue_type`,
`priority`, `sort_by`, `sort_order`.

`updateIssueStatus` `metadata` (`UpdateIssueStatusMetadata`): `assigned_to`,
`resolution_note`, `resolution_action`, `closure_reason`, `escalated_to`.

---

## 5. Selectors

| Selector | Returns |
|----------|---------|
| `selectOrderIssues` | Loaded issues. |
| `selectCurrentIssue` | Issue opened in detail view. |
| `selectOrderIssuesLoading` | Per-action loading flags. |
| `selectOrderIssuesError` | Friendly error string (or `null`). |
| `selectOrderIssuesPagination` | Pagination meta. |
| `selectIssueAnalytics` | Analytics data. |
| `selectAdminIssues` | Platform-wide issues (admin). |
| `selectOpenIssues` / `selectHighPriorityIssues` | Derived lists. |
| `selectIssuesByStatus(status)` / `selectIssuesByPriority(priority)` / `selectIssuesByType(type)` | Parameterised filters. |
| `selectIssuesForOrder(orderId)` | Issues for one order. |
| `selectIssueStats` | Client-side counts (`total`, `open`, `in_progress`, `resolved`, `closed`, `high_priority`). |

Sync actions: `setIssueFilters`, `setCurrentIssue`, `clearError`, `resetIssues`.

---

## 6. Optimistic updates, access & errors

- **Optimistic** — `updateIssueStatus` applies the new status immediately and
  rolls back on failure (snapshot registry). Create is prepended on success.
- **Access** — customers manage their own issues; vendors access their shop's
  issues (`verifyVendorShopAccess`); admins access everything. Analytics is
  vendor-scoped or admin-gated; `fetchAllIssues` is admin-only. RLS is the real
  gate.
- **Errors** — mapped by `toFriendlyOrderError`. Wrap issue screens:

```tsx
import { OrderIssueErrorBoundary } from '~/commerce/components/OrderIssueErrorBoundary'

<OrderIssueErrorBoundary scope="OrderIssues" onReset={() => dispatch(fetchUserIssues())}>
  <MyIssuesScreen />
</OrderIssueErrorBoundary>
```

---

## 7. Issue comments

Comment threads live in `order_issue_comments` (buyer / vendor / admin participants).

Use `getIssueComments` / `addIssueComment` from the service, or the Redux thunks
`fetchIssueComments` / `postIssueComment`. UI: `OrderIssueCommentsThread` on buyer
order detail and the vendor issue drawer.

Resolution notes on status changes remain for formal accept/reject messaging;
ongoing discussion should use the comment thread.
