# Listing Reviews — Developer Guide

Everything listing-review-related lives in **`lib/listing-reviews/`** and is exposed
through the same **Redux Toolkit** store used by shop, return-policy, and
shipping-policy features. This guide is for developers building **vendor**,
**admin**, **buyer**, or **shared** surfaces.

> **TL;DR** — Import typed hooks, read state with `useAppSelector`, and trigger
> work with `dispatch(thunk(args))`. Mutations update the UI **optimistically**
> and roll back automatically if the server rejects them. All errors are already
> turned into friendly messages via `toFriendlyListingReviewError()`.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `listing-reviews.constants.ts` | Status enums, limits, defaults, success/eligibility messages |
| `listing-reviews.type.ts` | TypeScript types (`ListingReview`, filters, analytics, dashboard, …) |
| `listing-reviews.errors.ts` | **Centralised error handling** — `ListingReviewError`, codes, `toFriendlyListingReviewError()` |
| `listing-reviews.validation.ts` | **Zod** schemas + parse/validate helpers |
| `listing-reviews.utils.ts` | Pure helpers (sort, stats, defaults, optimistic builders, rollback helpers) |
| `listing-reviews.service.ts` | Typed Supabase data-access. Dispatch thunks instead of calling directly. |
| `listing-reviews.store.ts` | Redux slice, async thunks, selectors. **Main entry point.** |
| `listing-reviews-ui.copy.ts` | Vendor hub UI strings |
| `listing-reviews-ui.utils.ts` | Hub stats, tab/search filters, export helpers |
| `index.ts` | Barrel exports |

Vendor UI lives under `commerce/components/vendor/listing-review/` and `commerce/screens/vendor/VendorListingReviewsHubPanel.tsx` (route: `/vendor/reviews` → Listing Reviews tab).

Redux key: **`listingReviews`** (registered in `lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Shop ownership / admin access | `canManageShop()` / `isAdminRole()` from `~/lib/shop/shop.utils` |
| Buyer-facing lightweight reads | `~/commerce/lib/reviews.ts` (unchanged — simple public fetch for product pages) |
| Verified purchase reviews (order-linked) | `~/commerce/lib/customer-order-trust.ts` → `submitVerifiedListingReview` RPC |

Use **`lib/listing-reviews`** when you need full CRUD, moderation, replies, votes,
reports, analytics, vendor dashboard, or Redux-managed state with optimistic updates.

---

## 2. Scopes

| Scope | Use case | Auth |
|-------|----------|------|
| `public` | Product pages, approved reviews only | Optional |
| `management` | Vendor/admin tables, all statuses | Required + shop access |

Set scope with `setListingReviewFetchScope('management')` or pass `scope` to `loadListingReviews`.

---

## 3. Quick start

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadListingReviews,
  selectListingReviews,
  setListingReviewFilters,
} from '~/lib/listing-reviews'

export function ListingReviewsPanel({ listingId }: { listingId: string }) {
  const dispatch = useAppDispatch()
  const reviews = useAppSelector(selectListingReviews)

  useEffect(() => {
    dispatch(setListingReviewFilters({ listing_ids: [listingId] }))
    dispatch(loadListingReviews({ reset: true, scope: 'public' }))
  }, [dispatch, listingId])

  return reviews.map((review) => <ReviewRow key={review.id} review={review} />)
}
```

### Vendor moderation

```tsx
dispatch(
  loadListingReviews({
    reset: true,
    scope: 'management',
    filters: { shop_id: shopId, status: ['pending', 'approved'] },
    accessContext: { userId, role },
  }),
)

dispatch(
  moderateListingReviews({
    input: {
      review_ids: selectedIds,
      updates: { review_status: 'approved' },
    },
    accessContext: { userId, role },
  }),
)
```

---

## 4. Optimistic mutations

These thunks stash a snapshot before mutating and restore on rejection:

- `createListingReview`
- `updateListingReview`
- `deleteListingReview`
- `moderateListingReviews`
- `voteListingReviewHelpfulness` / `removeListingReviewHelpfulnessVote`
- `createListingReviewReply` / `deleteListingReviewReply`

---

## 5. Migration from legacy (`E:\sheconomy`)

| Legacy | New |
|--------|-----|
| `lib/schemas/reviews/listing-review.js` (Yup) | `listing-reviews.validation.ts` (Zod) |
| `lib/utils/reviews/listing-reviews.js` | `listing-reviews.utils.ts` + `listing-reviews.constants.ts` |
| `lib/services/shared/reviews/listing/listing-reviews.js` | `listing-reviews.service.ts` |
| `stores/reviews/listing/listingReviewsStore.js` | `listing-reviews.store.ts` |

**Not migrated (UI-only):** modals, toasts, `selectedReviews`, form UI state.

**Public reads:** legacy used `listing_reviews_public_view` / `listing_review_summary_mv`.
The new service queries `listing_reviews` (approved filter) and `listing_review_analytics`,
with default empty summaries via `buildDefaultListingReviewSummary()`.

---

## 6. Error handling

Wrap review surfaces with an error boundary that calls `toFriendlyListingReviewError(error)`
(the same pattern as `ShippingPolicyErrorBoundary`).

```tsx
import { toFriendlyListingReviewError } from '~/lib/listing-reviews'
```

---

## 7. Architecture alignment

Follows the same pattern as `lib/return-policy/` and `lib/shipping-policy/`:

- Typed service responses (`ListingReviewServiceResponse<T>`)
- Zod validation with `.partial()` on update schemas **before** refinements
- Redux optimistic updates + `rollbackRegistry`
- `ListingReviewAccessContext` for admin impersonation / dashboard reuse
