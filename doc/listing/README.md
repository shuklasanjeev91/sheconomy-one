# Listing Store — Developer Guide

Everything listing-related lives in `lib/listing/` and is exposed through the
same **Redux Toolkit** store used by profiles and shops. This guide is for UI
developers who want to read listing state and dispatch listing actions from
screens/components — whether you're building **buyer** (browse/search/detail),
**vendor** (create/manage catalogue) or **admin** (feature/list-all/stats)
surfaces.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Mutations update the UI
> **optimistically** (instantly) and roll back automatically if the server
> rejects them. All errors are already turned into friendly messages.

---



## 1. File map


| File                                           | What it holds                                                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/listing/listing.type.ts`                  | All TypeScript types + constants (`Listing`, `ListingUpdate`, `ListingFormData`, `LISTING_TYPES`, `LISTING_STATUS`, `LISTING_TYPE_OPTIONS`, `getDefaultListingFormData`, …) |
| `lib/listing/listing.errors.ts`                | **Centralised listing error handling** — `ListingError`, `LISTING_ERROR_CODES`, `toFriendlyListingError()`                                                                  |
| `lib/listing/listing.validation.ts`            | **Zod** schema (`listingSchema`) + field validators for `useFormValidation` + `validateCategoryData`                                                                        |
| `lib/listing/listing.utils.ts`                 | Pure helpers (price, slug, availability, filter/sort, images, weight/dimensions, `canManageListing`)                                                                        |
| `lib/listing/listing.access.ts`                | Shared response (`ok`/`fail`) + access helpers (`verifyListingManageAccess`, `isAdminUser`) used by every service                                                           |
| `lib/listing/listing.service.ts`               | Typed Supabase data-access (listings + RPCs + admin). You normally **don't** call these directly — dispatch thunks.                                                         |
| `lib/listing/listing-images.service.ts`        | Image upload + **pluggable NSFW moderation hook** + CRUD                                                                                                                    |
| `lib/listing/listing-variations.service.ts`    | Variations CRUD + `replaceVariations`                                                                                                                                       |
| `lib/listing/listing-attributes.service.ts`    | Attributes CRUD + `replaceAttributes`                                                                                                                                       |
| `lib/listing/listing-materials.service.ts`     | Materials CRUD + `replaceMaterials`                                                                                                                                         |
| `lib/listing/listing.store.ts`                 | Main Redux slice, thunks, sync actions. **Your main entry point.**                                                                                                          |
| `lib/listing/listing-images.store.ts`          | Separate slice for a listing's images                                                                                                                                       |
| `lib/listing/listing-variations.store.ts`      | Separate slice for a listing's variations                                                                                                                                   |
| `lib/listing/listing-attributes.store.ts`      | Separate slice for a listing's attributes                                                                                                                                   |
| `lib/listing/listing-materials.store.ts`       | Separate slice for a listing's materials                                                                                                                                    |
| `commerce/components/ListingErrorBoundary.tsx` | Error boundary that renders friendly listing errors + a retry action                                                                                                        |
| `lib/store/hooks.ts`                           | **Typed hooks:** `useAppDispatch`**,** `useAppSelector`                                                                                                                     |


The Redux `<Provider>` is already wired at the app root (`app/_layout.tsx`). The
main listing slice persists `myListings` + `formData` so the seller catalogue
and an in-progress draft paint instantly on reload.

### Reuse note (no duplication)

Data sources (all migrated directly from the old `listingService`, no reliance on `~/commerce`):


| Concern                                                    | Source                                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public browse feed / by-type / category                    | `active_listings_view` (`getPublicListings`, `getListingsByType`, `getCategoryListings`)                                                                                 |
| Full-text search                                           | `search_listings` RPC (routed through `getPublicListings` when a search term is set)                                                                                     |
| Hydrate by ids                                             | `active_listings_view` with `listings` fallback (`getListingsByIds`)                                                                                                     |
| Featured feed                                              | `active_listings_view` filtered by `is_featured` (`getFeaturedListings`)                                                                                                 |
| Storage upload                                             | `~/lib/supabase/storage-upload`                                                                                                                                          |
| Shop catalogue / sections / stock / recommendations / tags | Postgres RPCs (`get_shop_listings`, `get_shop_sections_with_counts`, `update_listing_stock`, `get_listing_recommendations`, `get_popular_tags`, `admin_search_listings`) |


---



## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadMyListings, setListingStatus } from '~/lib/listing/listing.store'

export function MyListingsScreen() {
  const dispatch = useAppDispatch()
  const listings = useAppSelector((s) => s.listing.myListings)
  const isLoading = useAppSelector((s) => s.listing.isLoadingListings)

  useEffect(() => {
    dispatch(loadMyListings(undefined)) // undefined → use the signed-in user
  }, [dispatch])

  if (isLoading) return <Spinner />

  return listings.map((listing) => (
    <Row key={listing.id}>
      {listing.title}
      <Button onPress={() => dispatch(setListingStatus({ listingId: listing.id, status: 'active' }))}>
        Publish
      </Button>
    </Row>
  ))
}
```

That `setListingStatus` call flips the listing to active **immediately**; if the
API rejects it, the previous status is restored and `s.listing.error` is set.

---



## 3. State shape



### Main slice — `useAppSelector((s) => s.listing.<field>)`


| Field                                                                                               | Type                          | Meaning                                                                    |
| --------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `myListings`                                                                                        | `Listing[]`                   | Listings across the user's shops (persisted)                               |
| `shopListings`                                                                                      | `ShopListingRow[]`            | One shop's catalogue via `get_shop_listings` (owner/admin view)            |
| `publicListings`                                                                                    | `PublicListing[]`             | Public browse/search results (rows from `active_listings_view`, paginated) |
| `adminListings`                                                                                     | `AdminListingRow[]`           | Admin "all listings" search results                                        |
| `currentListing`                                                                                    | `ListingDetails | null`       | Full detail (view row + category assignments)                              |
| `featuredListings`                                                                                  | `PublicListing[]`             | Recommended/featured feed                                                  |
| `popularTags`                                                                                       | `PopularTag[]`                | Popular marketplace tags                                                   |
| `recommendations`                                                                                   | `RecommendedListing[]`        | Related listings for `currentListing`                                      |
| `platformStats`                                                                                     | `PlatformListingStats | null` | Admin counts (total/active/draft/featured/by-type)                         |
| `formData`                                                                                          | `ListingFormData`             | Create/edit form buffer (persisted)                                        |
| `validation`                                                                                        | `{ isValid; errors }`         | Result of `validateForm`                                                   |
| `isLoading` / `isLoadingListings` / `isLoadingDetails` / `isCreating` / `isUpdating` / `isDeleting` | `boolean`                     | In-flight flags                                                            |
| `error`                                                                                             | `string | null`               | Last **friendly** error message (cleared on next action)                   |
| `totalPublicListings` / `hasMorePublicListings` / `publicOffset`                                    | pagination                    | Public feed paging (offset-based)                                          |




### Child slices (separate reducers)


| Slice      | Selector root         | State                                                                  |
| ---------- | --------------------- | ---------------------------------------------------------------------- |
| Images     | `s.listingImages`     | `{ items: ListingImage[]; isLoading; isUploading; isMutating; error }` |
| Variations | `s.listingVariations` | `{ items: ListingVariation[]; isLoading; isMutating; error }`          |
| Attributes | `s.listingAttributes` | `{ items: ListingAttribute[]; isLoading; isMutating; error }`          |
| Materials  | `s.listingMaterials`  | `{ items: ListingMaterial[]; isLoading; isMutating; error }`           |


Each child slice also stores `byListingId` so you can tell which listing the
loaded collection belongs to.

---



## 4. How optimistic UI works (important)

Every **mutation** thunk follows the same three-phase lifecycle:

1. `pending` → the change is applied to Redux state **right away** so the UI
  updates instantly. `createListing` inserts a temporary row with a `temp-…`
   id; add/update/delete on children patch the collection immediately.
2. `fulfilled` → the optimistic value is reconciled with the **authoritative
  server row** (temp row swapped for the real one, patches replaced).
3. `rejected` → the change is **rolled back** to the previous state and
  `error` is set (already a friendly message).

Snapshots used for rollback are kept outside Redux state (keyed by the thunk's
`requestId`), so state stays serializable.

Optimistic actions — main slice: `createListing`, `updateListing`,
`updateListingWithDetails`, `deleteListing`, `setListingStatus`,
`setListingActive`, `setListingFeatured`, `adjustStock`, `adminUpdateListing`.
Child slices: every `add*` / `update*` / `delete*` / `reorderImages`.

> **Uploads are the one exception:** `uploadImage` has no optimistic row because
> we don't have a URL until the file lands (and is moderated). Show
> `s.listingImages.isUploading` instead.

**What this means for you:** just dispatch and render from state. No manual list
mutation or refetch after a write.

---



## 5. Async thunks (dispatch these)



### Buyer / public — `~/lib/listing/listing.store`


| Thunk                  | Arg                                                            | Does                                                                                    |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `loadPublicListings`   | `{ filters?: ListingFilters, pagination?: ListingPagination }` | Filterable browse feed from `active_listings_view`; `pagination.offset > 0` **appends** |
| `searchListings`       | `{ query, filters?, pagination? }`                             | Full-text search via the `search_listings` RPC; `pagination.offset > 0` appends         |
| `loadListingDetails`   | `{ listingId?, slug? }`                                        | Loads `currentListing` (detail + categories)                                            |
| `loadFeaturedListings` | `limit?: number`                                               | Loads `featuredListings`                                                                |
| `loadPopularTags`      | `limit?: number`                                               | Loads `popularTags`                                                                     |
| `loadRecommendations`  | `{ listingId, limit? }`                                        | Loads `recommendations`                                                                 |




### Vendor


| Thunk                      | Arg                                              | Does                                                             |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `loadMyListings`           | `{ query?, userId? }`                            | Listings across the user's shops → `myListings`                  |
| `loadShopListings`         | `{ shopId, query? }`                             | One shop's catalogue → `shopListings`                            |
| `createListing`            | `{ formData, userId? }`                          | Creates listing + child rows, optimistic                         |
| `updateListing`            | `{ listingId, updates: ListingUpdate, userId? }` | Patches main row, optimistic                                     |
| `updateListingWithDetails` | `{ listingId, formData, userId? }`               | Main row + provided child collections (full replace), optimistic |
| `deleteListing`            | `{ listingId, userId? }`                         | Deletes (children cascade), optimistic                           |
| `setListingStatus`         | `{ listingId, status, userId? }`                 | draft/active/paused/sold_out/archived, optimistic                |
| `setListingActive`         | `{ listingId, isActive, userId? }`               | Toggle active, optimistic                                        |
| `setListingFeatured`       | `{ listingId, isFeatured, userId? }`             | Toggle featured, optimistic                                      |
| `adjustStock`              | `{ listingId, quantityChange, variationId? }`    | Atomic stock change (RPC), optimistic                            |




### Admin


| Thunk                      | Arg                               | Does                                                                                                |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `loadAdminListings`        | `{ query? }`                      | Search across **all** shops (`admin_search_listings`) → `adminListings`; `query.offset > 0` appends |
| `adminUpdateListing`       | `{ listingId, updates, userId? }` | Update any listing, optimistic                                                                      |
| `setListingFeatured`       | `{ listingId, isFeatured }`       | Also usable by admin to feature any listing                                                         |
| `loadPlatformListingStats` | `userId?`                         | Loads `platformStats` (admin only)                                                                  |


> Admin thunks read/write across **all** listings; authorisation is enforced by
> Supabase RLS. Use `canManageListing(shopUserId, userId, role)` from
> `listing.utils` to gate admin/owner UI.



### Child collections

Images — `~/lib/listing/listing-images.store`:


| Thunk           | Arg                                                                                     |
| --------------- | --------------------------------------------------------------------------------------- |
| `loadImages`    | `listingId`                                                                             |
| `addImage`      | `{ listingId, imageUrl, isPrimary?, displayOrder?, userId? }`                           |
| `uploadImage`   | `{ listingId, file: ListingImageUpload, isPrimary?, displayOrder?, altText?, userId? }` |
| `updateImage`   | `{ imageId, updates, userId? }`                                                         |
| `deleteImage`   | `{ imageId, userId? }`                                                                  |
| `reorderImages` | `{ listingId, order: string[], userId? }`                                               |


Variations / Attributes / Materials — symmetric APIs from their stores:
`load*(listingId)`, `add*({ listingId, <row>, userId? })`,
`update*({ <id>, updates, userId? })`, `delete*({ <id>, userId? })`.

---



## 6. Sync actions (pure UI / form state)

Imported from `~/lib/listing/listing.store`:


| Action                 | Arg                        | Does                                                             |
| ---------------------- | -------------------------- | ---------------------------------------------------------------- |
| `setListingFormData`   | `Partial<ListingFormData>` | Merge into the form buffer                                       |
| `updateListingField`   | `{ field, value }`         | Set one form field                                               |
| `initFormForType`      | `ListingType`              | Reset the form to defaults for a type (physical/digital/service) |
| `loadFormFromListing`  | `ListingFormData`          | Seed the form from an existing listing                           |
| `resetListingFormData` | —                          | Clear the form + validation                                      |
| `validateForm`         | —                          | Run Zod validation → `s.listing.validation`                      |
| `setCurrentListing`    | `ListingDetails | null`    | Set the viewed detail                                            |
| `clearListingError`    | —                          | Clear the error banner                                           |
| `resetListings`        | —                          | Reset the whole slice (e.g. on sign-out)                         |


Child slices each expose a `reset*` action (`resetImages`, `resetVariations`,
`resetAttributes`, `resetMaterials`).

---



## 7. Errors & toasts (meaningful messages)

Every service failure is routed through `toFriendlyListingError`, so
`s.listing.error` is always human-readable. To show a toast, `unwrap()` the thunk:

```tsx
import { useAppToast } from '~/components/ui'
import { createListing } from '~/lib/listing/listing.store'

const toast = useAppToast()

async function onCreate() {
  try {
    await dispatch(createListing({ formData })).unwrap()
    toast.show('Listing created', { tone: 'success' })
  } catch (message) {
    // `message` is already a friendly string; the UI was rolled back.
    toast.show('Couldn’t create listing', { tone: 'danger', message: String(message) })
  }
}
```

Wrap listing screens in the boundary to catch render-time failures:

```tsx
import { ListingErrorBoundary } from '~/commerce/components/ListingErrorBoundary'

<ListingErrorBoundary scope="CreateListing" onReset={() => dispatch(loadMyListings(undefined))}>
  <CreateListingScreen />
</ListingErrorBoundary>
```

Need to classify an error yourself? Use `classifyListingError(error)` →
`LISTING_ERROR_CODES.*` (includes `NSFW_CONTENT`, `OUT_OF_STOCK`,
`IMAGE_TOO_LARGE`, `SLUG_TAKEN`, …).

---



## 8. Validation (Zod + form fields)

For full-object validation, use the Zod schema via `validateListingData`. It
enforces type-specific rules (physical → stock + materials + variations; digital
→ file type/url; service → booking duration):

```tsx
import { validateListingData } from '~/lib/listing/listing.validation'

const { isValid, errors } = validateListingData(formData)
if (!isValid) return toast.show(Object.values(errors)[0])
```

For live form fields, plug the validators into `useFormValidation`:

```tsx
import { useFormValidation } from '~/hooks/useFormValidation'
import { listingTitleValidator, listingPriceValidator } from '~/lib/listing/listing.validation'

const form = useFormValidation({
  title: { validators: [listingTitleValidator] },
  price: { validators: [listingPriceValidator] },
})

if (!form.validateAll()) return
```

Helpers: `validateListingCore(data)` (title/type/price only),
`isListingReadyForSubmission(data)`, and `validateCategoryData(categories)`
(dedupes, caps, guarantees one primary).

---



## 9. Display & domain helpers (`listing.utils`)


| Helper                                                                                                   | Does                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `formatListingPrice(price, currency)`                                                                    | Money formatting (wraps `~/lib/format`), "Free" for 0        |
| `generateListingSlug(title)`                                                                             | URL-friendly slug                                            |
| `getListingTypeInfo` / `getListingStatusInfo` / `getServiceTypeInfo` / `getDigitalFileTypeInfo`          | Option lookups for labels/icons                              |
| `checkListingAvailability(listing)`                                                                      | `{ available, reason }` (active/status/stock aware)          |
| `isProductOutOfStock(listing)`                                                                           | Quick stock check                                            |
| `filterListings` / `sortListings`                                                                        | Pure client-side list ops                                    |
| `getPrimaryListingImage` / `hasListingImage`                                                             | Resolve the hero image                                       |
| `generateSuggestedTags(title)`                                                                           | Simple tag suggestions                                       |
| `formatFileSize` / `convertWeightToKg` / `formatWeight` / `formatDimensions` / `calculateShippingWeight` | Physical/digital formatting                                  |
| `validateImageFile(file)`                                                                                | Client-side pre-upload check                                 |
| `canManageListing(shopUserId, userId, role)`                                                             | Owner / admin gate for UI                                    |
| `prepareListingDataForSubmission(formData)`                                                              | Clean form → `listings` insert payload (used by the service) |


---



## 10. Image moderation (NSFW hook)

`listing-images.service.ts` screens every upload through a **pluggable
moderator**. No image is uploaded before it's moderated; if any image in a batch
is rejected, the whole batch is aborted (and already-uploaded files are rolled
back).

Until the NSFW classifier is migrated, no moderator is registered and uploads
**fail open** (proceed) — exactly like the legacy behaviour when analysis was
unavailable. Once the classifier lands, register it once at startup:

```ts
import { registerImageModerator } from '~/lib/listing/listing-images.service'
import { analyzeImageContent, analyzeBatchImageContent } from '~/lib/nsfwjs/nsfw-classifier'

registerImageModerator({
  analyze: async (image) => {
    const r = await analyzeImageContent(image)
    return { verdict: r.verdict, reasons: r.rejectionReasons, confidence: r.confidence }
  },
  analyzeBatch: async (images, onProgress) => {
    const r = await analyzeBatchImageContent(images, { onProgress })
    return { results: r.results.map((x) => ({ verdict: x.verdict, reasons: x.rejectionReasons })) }
  },
})
```

After that, `uploadImage` / `batchUploadImages` automatically reject
inappropriate images with `LISTING_ERROR_CODES.NSFW_CONTENT`.

---



## 11. Common recipes

**Create a listing (with images/variations/etc.) from the form**

```tsx
dispatch(validateForm())
const { isValid } = useAppSelector((s) => s.listing.validation)
if (isValid) await dispatch(createListing({ formData })).unwrap()
```

**Infinite-scroll public feed**

```tsx
const { publicListings, publicOffset, hasMorePublicListings } = useAppSelector((s) => s.listing)

// first page
dispatch(loadPublicListings({ filters: { listingType: 'physical' } }))

// next page (appends because offset > 0)
if (hasMorePublicListings) {
  dispatch(loadPublicListings({
    filters: { listingType: 'physical' },
    pagination: { offset: publicOffset },
  }))
}

// search
dispatch(searchListings({ query: 'handmade soap', pagination: { offset: 0 } }))
```

**Edit a listing's images independently**

```tsx
useEffect(() => { dispatch(loadImages(listingId)) }, [listingId])
dispatch(uploadImage({ listingId, file }))          // moderated + uploaded
dispatch(reorderImages({ listingId, order: ids }))  // optimistic
```

**Admin: feature a listing / load platform stats**

```tsx
dispatch(setListingFeatured({ listingId, isFeatured: true }))
dispatch(loadPlatformListingStats())
```

**Reset on sign-out**

```tsx
dispatch(resetListings())
dispatch(resetImages())
dispatch(resetVariations())
dispatch(resetAttributes())
dispatch(resetMaterials())
```

---



## 12. Do / Don't

- ✅ Dispatch thunks/actions; read via `useAppSelector`.
- ✅ Trust optimistic updates — don't manually mutate lists or refetch after a write.
- ✅ Use `.unwrap()` when you need success/error toasts; `s.listing.error` is always friendly.
- ✅ Gate admin/owner UI with `canManageListing(shopUserId, userId, role)`.
- ✅ Use the separate child slices when a screen only edits images/variations/attributes/materials.
- ❌ Don't call `listing*.service.*` directly from components (bypasses the store/optimistic layer).
- ❌ Don't store `Blob`/`File` in Redux — pass them only as thunk args (e.g. `uploadImage`).
- ❌ Don't skip moderation by uploading straight to storage — always go through the images service.

