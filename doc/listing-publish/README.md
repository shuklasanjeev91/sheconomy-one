# Listing Publish Workflow — Developer Guide

The **Publish** workflow is what runs when a seller taps "Publish" on a
finished listing. Instead of one big insert, it walks a **sequence of steps**
(main listing → images → categories → variations → attributes → materials →
tags → shop sections → search indexing), reports **live progress** for each
step, and **rolls the whole listing back** if a critical step fails.

It lives in **`lib/listing/`** alongside the rest of the listing code and is
driven through the same **Redux Toolkit** store used everywhere else.

> **TL;DR** — Dispatch `publishListing({ listingData })`, subscribe to
> `selectPublishProgressInfo` for a progress bar, and wrap the screen in
> `ListingPublishErrorBoundary`. Every table write **reuses the already-migrated
> listing services** — there is no duplicate query logic here.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/listing/listing-publish.orchestrator.ts` | The step-by-step engine. Exposes `listingPublishOrchestrator.publishListing()` + `getPublishingProgress()`, the `PUBLISH_STEPS` constants and all publish types. |
| `lib/listing/listing-publish.store.ts` | **Redux slice + thunks.** Your main entry point (`publishListing`, `checkPublishingProgress`, `resetPublishState`, selectors). |
| `lib/listing/sku.utils.ts` | Cross-platform SKU helpers (`normalizeSku`, `generateUniqueSku`) used to assign a SKU to physical listings. |
| `commerce/components/ListingPublishErrorBoundary.tsx` | Error boundary that renders a friendly message (via `toFriendlyListingError`) + a retry action if a publish screen crashes. |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`.** |

The slice is registered as `listingPublish` in the root store
(`lib/store/index.ts`). It is **not** persisted — publishing is a transient,
per-session action.

### Reuse note (no duplication)

Every write delegates to code that was already migrated:

| Step | Reuses |
|------|--------|
| Payload prep | `prepareListingDataForSubmission` (`listing.utils`) |
| Slug | `generateListingSlug` (`listing.utils`) |
| SKU (physical) | `normalizeSku` / `generateUniqueSku` (`sku.utils`) |
| Shop ownership check | `verifyShopManageAccess` (`listing.access`) |
| Images | `batchUploadImages` + `addImage` (`listing-images.service`) — includes the NSFW moderation pass |
| Categories | `assignCategories` (`listing.service`) |
| Variations / Attributes / Materials | `replaceVariations` / `replaceAttributes` / `replaceMaterials` (child services) |
| Rollback | `deleteListing` (`listing.service`) |
| Tags | inline insert into `listing_tags` (no dedicated service exists yet) |
| **Shop sections** | `addListingToSection` ([`lib/shop/shop-sections.service.ts`](../../lib/shop/shop-sections.service.ts)) |

> Logging from the legacy orchestrator was intentionally **not** migrated.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  publishListing,
  resetPublishState,
  selectPublishProgressInfo,
} from '~/lib/listing/listing-publish.store'
import { ListingPublishErrorBoundary } from '~/commerce/components/ListingPublishErrorBoundary'

function PublishButton({ listingData }) {
  const dispatch = useAppDispatch()
  const progress = useAppSelector(selectPublishProgressInfo)

  const onPublish = async () => {
    const action = await dispatch(publishListing({ listingData }))
    const result = action.payload // PublishResult
    if (result?.success) {
      // navigate to the new listing: result.listing_id
    }
  }

  return (
    <ListingPublishErrorBoundary onReset={() => dispatch(resetPublishState())}>
      {progress.isPublishing ? (
        <ProgressBar percent={progress.progressPercentage} label={progress.description} />
      ) : (
        <Button onPress={onPublish}>Publish</Button>
      )}
      {progress.hasError && <ErrorText>{progress.errorMessage}</ErrorText>}
    </ListingPublishErrorBoundary>
  )
}
```

---

## 3. Input shape (`PublishListingData`)

It's the standard `ListingFormData` plus an optional `shop_sections` array, so
the same object your create/edit form already builds works here:

```ts
type PublishListingData = Partial<ListingFormData> & { shop_sections?: string[] }
```

Required to publish (enforced by the validation step): `shop_id`, `title`,
`description`, `listing_type`, `price`, and **at least one image**. Each image
must carry either an upload payload (`blob` + `mimeType`) or an existing
`image_url`. Type-specific requirements:

| `listing_type` | Also required |
|----------------|---------------|
| `physical` | `stock` (SKU is auto-generated if omitted) |
| `digital` | `digital_file_url` |
| `service` | `booking_duration_minutes` |

---

## 4. Actions & selectors

### Thunks

| Thunk | Args | Does |
|-------|------|------|
| `publishListing` | `{ listingData, options? }` | Runs the full workflow. Dispatches live progress; resolves with the `PublishResult`. |
| `checkPublishingProgress` | `listingId: string` | Reads current DB state (status + child-table counts) into `stepResults.progress_check`. |

`options` (optional) overrides the stored config per call:
`{ publishImmediately?: boolean; rollbackOnFailure?: boolean }`.
`publishImmediately: false` creates the listing as a **draft**.

### Sync actions

| Action | Use |
|--------|-----|
| `updatePublishConfig(partial)` | Change the default `publishImmediately` / `rollbackOnFailure`. |
| `resetPublishState()` | Clear progress / result / error (call before a retry, or on unmount). |

### Selectors

| Selector | Returns |
|----------|---------|
| `selectPublishProgressInfo(state)` | `{ isPublishing, currentStep, description, progressPercentage, completedSteps, failedSteps, totalSteps, hasError, isComplete, errorMessage, result }` — everything a progress UI needs. |
| `selectPublicationStatus(state)` | `{ isActive, progress, hasError, isComplete, canRetry }`. |
| `selectPublicationSummary(state)` | `null` until finished, then `{ success, listingId, stepsCompleted, stepsFailed, rollbackPerformed, summary: { images, variations, attributes, materials, tags, sections } }`. |

---

## 5. How failures & rollback work

- **Required steps** (`validation`, `main_listing`, `images`) failing → the
  publish **aborts**. If the main listing was already created and
  `rollbackOnFailure` is on (default), it is **deleted** (child rows cascade),
  and `result.rollback_performed` is `true`.
- **Optional steps** (categories, variations, attributes, materials, tags,
  shop_sections, indexing) failing → publishing **continues**; the failure is
  recorded in `result.steps_failed` and surfaced via `onError`, but the listing
  stays live.
- Error messages shown to the user always go through `toFriendlyListingError`,
  so NSFW rejections, permission errors, upload failures, etc. read cleanly.

---

## 6. Shop sections

The publish step calls `addListingToSection(sectionId, listingId)` for each id in
`publishData.shop_sections`. Missing/invalid section ids are counted as
`sections_skipped`; the listing still goes live (optional step).

Vendor UI that manages sections continues to use
`fetchVendorShopSections` / `saveVendorShopSection` in
`commerce/lib/vendor-operations.ts`.
