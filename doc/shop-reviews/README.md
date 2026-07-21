# Shop Reviews — Developer Guide

Everything shop-review-related lives in **`lib/shop-review/`** and is exposed
through the same **Redux Toolkit** store used by shop, listing-reviews, and
policy features.

> **TL;DR** — Import typed hooks, read state with `useAppSelector`, and trigger
> work with `dispatch(thunk(args))`. Mutations update the UI **optimistically**
> and roll back automatically if the server rejects them.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `shop-review.constants.ts` | Status enums, limits, defaults, success/eligibility messages |
| `shop-review.type.ts` | TypeScript types (`ShopReview`, filters, stats, pagination, …) |
| `shop-review.errors.ts` | **Centralised error handling** — `ShopReviewError`, codes, `toFriendlyShopReviewError()` |
| `shop-review.validation.ts` | **Zod** schemas + parse/validate helpers |
| `shop-review.utils.ts` | Pure helpers (sort, stats, permissions, optimistic builders) |
| `shop-review.service.ts` | Typed Supabase data-access + shop rating refresh |
| `shop-review.store.ts` | Redux slice, async thunks, selectors. **Main entry point.** |
| `index.ts` | Barrel exports |

Redux key: **`shopReview`** (registered in `lib/store/index.ts`).

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Shop ownership / admin access | `canManageShop()` / `isAdminRole()` from `~/lib/shop/shop.utils` |
| Buyer-facing lightweight reads | `~/commerce/lib/reviews.ts` (`fetchShopReviews` RPC fallback) |

Use **`lib/shop-review`** when you need full CRUD, vendor responses, moderation,
votes, reports, stats, or Redux-managed state with optimistic updates.

---

## 2. Scopes

| Scope | Use case | Auth |
|-------|----------|------|
| `public` | Shop profile pages, approved reviews only | Optional |
| `management` | Vendor/admin tables, all statuses | Required + shop access |

---

## 3. Quick start

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadShopReviews,
  selectShopReviews,
  setShopReviewShopId,
} from '~/lib/shop-review'

export function ShopReviewsPanel({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const reviews = useAppSelector(selectShopReviews)

  useEffect(() => {
    dispatch(setShopReviewShopId(shopId))
    dispatch(
      loadShopReviews({
        query: { shop_id: shopId, page: 1, limit: 10 },
        reset: true,
        scope: 'public',
      }),
    )
  }, [dispatch, shopId])

  return reviews.map((review) => <ReviewRow key={review.id} review={review} />)
}
```

---

## 4. Optimistic mutations

These thunks stash a snapshot before mutating and restore on rejection:

- `createShopReview`, `updateShopReview`, `deleteShopReview`
- `moderateShopReviews`, `bulkModerateShopReviews`
- `createShopReviewResponse`
- `voteShopReviewHelpfulness`, `removeShopReviewHelpfulnessVote`
- `reportShopReview`

---

## 5. Shop rating refresh

Legacy `update-shop-ratings.js` is ported as `refreshShopRatingsFromReviews()`.
The service schedules it automatically after create, delete, and moderation.

---

## 6. Migration from legacy (`E:\sheconomy`)

| Legacy | New |
|--------|-----|
| `lib/schemas/reviews/shop-review.js` | `shop-review.validation.ts` |
| `lib/utils/reviews/shop-reviews.js` | `shop-review.utils.ts` + `shop-review.constants.ts` |
| `lib/services/shared/reviews/shop/shop-review.js` | `shop-review.service.ts` |
| `update-shop-ratings.js` | `refreshShopRatingsFromReviews()` in service |
| `stores/reviews/shop/shopReviewsStore.js` | `shop-review.store.ts` |

**Not migrated (UI-only):** modals, toasts, form UI state.

**Delete behavior:** soft-delete via `review_status = hidden` (reviewer, shop owner, or admin).

---

## 7. Error handling

Use `toFriendlyShopReviewError(error)` in banners and error boundaries
(same pattern as `ShippingPolicyErrorBoundary` / listing-reviews).
