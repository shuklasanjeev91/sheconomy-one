# Sale Events Store — Developer Guide

Everything sale-event related lives in **`lib/sale/`** and is exposed through the
same **Redux Toolkit** store used by profiles, shops and CMS. This guide is for
UI developers building **admin** (create events/offers, review enrollments),
**vendor** (discover events, join/withdraw, see event discounts), or **public**
(storefront promo) surfaces.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Vendor join/withdraw and admin
> accept/reject update the UI **optimistically** (instantly) and roll back
> automatically if the server rejects them. All errors are already turned into
> friendly messages via `sale.errors`.

This module is a 1:1 migration of the legacy `sales.event-*` files (Zustand →
Redux Toolkit), re-typed against the generated Supabase schema.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/sale-event/sale-event.type.ts` | All TypeScript types + constants (`SaleEvent`, `EventOffer`, `SaleEventDetail`, `SALE_EVENT_STATUS`, `DISCOUNT_TYPE`, `OFFER_APPLIES_TO`, `ENROLLMENT_STATUS`, banner constants). Currency options are **reused** from `lib/shop`. |
| `lib/sale-event/sale-event.errors.ts` | **Centralised error handling** — `SaleError`, `SALE_ERROR_CODES`, `classifySaleError`, `toFriendlySaleError` |
| `lib/sale-event/sale-event.validation.ts` | **Zod** schemas (`createEventSchema`, `createEventOfferSchema`, …) + `parseOrThrow` / `validate` runners |
| `lib/sale-event/sale-event.utils.ts` | Pure helpers (currency/discount labels, slug, status/registration windows, date formatting, banner validation, offer normalizer, enrollment helpers) |
| `lib/sale-event/sale-event.service.ts` | Typed Supabase data-access functions. You normally do **not** call these directly — dispatch thunks instead. |
| `lib/sale-event/sale-event.store.ts` | Redux slice, async thunks, sync actions. **This is your main entry point.** |
| `lib/sale-event/index.ts` | Barrel — import everything from `~/lib/sale-event`. |
| `commerce/components/SaleEventErrorBoundary.tsx` | Error boundary that renders friendly sale errors + a retry action |
| `supabase/migrations/20260718120000_sale_events_setup.sql` | Tables, discount-sync trigger, RLS, and the `sale-event-banners` storage bucket |

The sale slice is registered as **`state.sale`** in `lib/store/index.ts`. It is
**not** persisted (event data is always fresh from the server).

### Reuse note (no duplication)

| Concern | Reuses |
|---------|--------|
| Currency list / symbols | `~/lib/shop/shop.type` (`SUPPORTED_CURRENCIES`) + `~/lib/shop/shop.utils` (`getCurrencySymbol`) |
| Role gating (RLS) | `public.cms_get_role()` (defined by the CMS migration) → `'A' | 'V' | 'U'` |
| Banner upload | `~/lib/supabase/storage-upload` (`uploadStorageObject`) into the `sale-event-banners` bucket |
| Discount sync | DB trigger `trg_sync_event_discounts` copies accepted event offers into `discount_profiles` |

---

## 2. The 30-second version

**Admin — list + create an event**

```tsx
import { useEffect } from 'react'
import { unwrapResult } from '@reduxjs/toolkit'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadEvents, createEvent } from '~/lib/sale-event'

export function AdminSaleEvents() {
  const dispatch = useAppDispatch()
  const events = useAppSelector((s) => s.sale.events)
  const isLoading = useAppSelector((s) => s.sale.isLoadingEvents)

  useEffect(() => {
    dispatch(loadEvents())
  }, [dispatch])

  async function onCreate(formData: unknown) {
    await dispatch(createEvent(formData)).unwrap() // throws friendly string on failure
  }

  // render events…
}
```

**Vendor — join an active event (optimistic)**

```tsx
import { joinEvent } from '~/lib/sale-event'

dispatch(joinEvent({ eventId, shopId })) // row appears instantly, rolls back on error
```

---

## 3. State shape

`useAppSelector((s) => s.sale.<field>)`

| Field | Type | Meaning |
|-------|------|---------|
| `events` | `SaleEventWithCounts[]` | Admin event list (offer/enrollment counts) |
| `activeEvents` | `SaleEventForVendor[]` | Active events for vendor discovery |
| `currentEvent` | `SaleEventDetail \| null` | Currently viewed/edited event (offers + counts) |
| `offers` | `EventOffer[]` | Offers for the open event |
| `enrollments` | `SaleEnrollmentRow[]` | Admin (per event, has `shops`) or vendor (per shop, has `sale_events` + `canWithdraw`) depending on which loader ran |
| `enrolledEventDiscounts` | `EnrolledEventDiscount[]` | Event-sourced `discount_profiles` for a shop |
| `categories` | `SaleCategoryOption[]` | Offer category picker results |
| `pickerListings` | `SaleListingOption[]` | Offer product picker results (append on paging) |
| `offerCategories` / `offerListings` | link rows | Items already attached to the open offer |
| `error` | `string \| null` | Last **friendly** error message |
| `successMessage` | `string \| null` | Last success message |
| `isLoadingEvents` / `isSavingEvent` / `isEnrolling` / `isUpdatingEnrollment` / … | `boolean` | In-flight flags (one per operation group) |

---

## 4. How optimistic UI works

These mutation thunks apply changes to Redux **before** the server responds and
reconcile/roll back afterwards. Rollback snapshots are kept **outside** Redux
(keyed by the thunk `requestId`) so state stays serializable.

| Thunk | Optimistic behaviour |
|-------|----------------------|
| `createEvent` | Inserts a temp `optimistic-…` row, swaps for the server row on success, removes on failure |
| `updateEvent` | Merges the patch immediately, reconciles/rolls back |
| `deleteEvent` | Removes the row immediately, restores on failure |
| `updateEnrollmentStatus` | Flips status immediately (admin accept/reject), rolls back on failure |
| `joinEvent` | Adds a temp pending enrollment, swaps for the server row, removes on failure |
| `withdrawEnrollment` | Removes the enrollment immediately, restores on failure |

**What this means for you:** just dispatch and render from state — no manual
list mutation or refetch after a write.

---

## 5. Async thunks (dispatch these)

All imported from `~/lib/sale`.

### Admin — events

| Thunk | Arg | Does |
|-------|-----|------|
| `loadEvents` | — | All events + counts → `events` |
| `loadEventById` | `id` | Event detail → `currentEvent` (+ `offers`) |
| `loadEventBySlug` | `slug` | Event detail by slug → `currentEvent` |
| `createEvent` | `formData` | Validates + creates (optimistic) |
| `updateEvent` | `{ eventId, payload }` | Validates + updates (optimistic) |
| `deleteEvent` | `eventId` | Deletes (optimistic; DB cascades offers/enrollments) |

### Admin — offers & attachments

| Thunk | Arg | Does |
|-------|-----|------|
| `createOffer` | `formData` | Normalizes numbers + validates + creates → prepends to `offers` |
| `attachCategoriesToOffer` | `{ offerId, categoryIds }` | Adds category links (idempotent) |
| `attachListingsToOffer` | `{ offerId, listingIds }` | Adds listing links (idempotent) |
| `replaceOfferCategories` | `{ offerId, categoryIds }` | Replaces the whole category selection |
| `replaceOfferListings` | `{ offerId, listingIds }` | Replaces the whole product selection |
| `loadOfferCategories` / `loadOfferListings` | `offerId` | Loads currently-attached ids (edit mode) |

### Admin — enrollments

| Thunk | Arg | Does |
|-------|-----|------|
| `loadEventEnrollments` | `eventId` | Enrollments + shop details → `enrollments` |
| `updateEnrollmentStatus` | `{ enrollmentId, status }` | Accept / reject (optimistic). The DB trigger syncs `discount_profiles`. |

### Vendor

| Thunk | Arg | Does |
|-------|-----|------|
| `loadActiveEvents` | — | Active events + summarised offers → `activeEvents` |
| `joinEvent` | `{ eventId, shopId }` | Enroll (optimistic) |
| `withdrawEnrollment` | `enrollmentId` | Withdraw pending enrollment (optimistic) |
| `loadVendorEnrollments` | `shopId` | Enrollment history (+ `canWithdraw`) → `enrollments` |
| `loadEnrolledEventDiscounts` | `shopId` | Event-sourced discounts → `enrolledEventDiscounts` |

### Pickers (admin offer creation)

| Thunk | Arg | Does |
|-------|-----|------|
| `loadCategories` | `{ parentId?, search?, status?, langCode? }` | Category picker (top-level / drill-down / search) |
| `loadAllActiveCategories` | — | Full flat active category tree |
| `loadListingsForPicker` | `{ shopIds?, search?, listingType?, limit?, offset? }` | Product picker; `offset > 0` **appends** for infinite scroll |

> All thunks read/write across roles; the actual authorisation is enforced by
> Supabase RLS: admins (`role = 'A'`) get full CRUD on events/offers, vendors
> (`role = 'V'`) can only read active events and manage their own enrollments,
> and everyone can read active events on the storefront.

---

## 6. Sync actions (pure UI / state)

Imported from `~/lib/sale`:

| Action | Arg | Does |
|--------|-----|------|
| `setCurrentEvent` | `SaleEventDetail \| null` | Set the open event |
| `clearCurrentEvent` | — | Clear the open event + its offers/attachments |
| `clearMessages` | — | Clear `error` + `successMessage` |
| `setSaleError` | `string \| null` | Set the error banner manually |
| `clearPickerState` | — | Clear category/listing picker state (on modal close) |
| `resetSale` | — | Reset the whole slice (e.g. on sign-out) |

---

## 7. Errors & toasts (meaningful messages)

Every service failure is routed through **`toFriendlySaleError`**, so
`s.sale.error` is always human-readable. To show a toast, `unwrap()` the thunk:

```tsx
import { useAppToast } from '~/components/ui'
import { joinEvent } from '~/lib/sale-event'

const toast = useAppToast()

async function onJoin() {
  try {
    await dispatch(joinEvent({ eventId, shopId })).unwrap()
    toast.show('Enrolled', { tone: 'success' })
  } catch (message) {
    // `message` is already a friendly string; the optimistic row was rolled back.
    toast.show('Couldn’t join event', { tone: 'danger', message: String(message) })
  }
}
```

Wrap sale screens in the boundary to catch render-time failures:

```tsx
import { SaleEventErrorBoundary } from '~/commerce/components/SaleEventErrorBoundary'

<SaleEventErrorBoundary scope="AdminSaleEvents" onReset={() => dispatch(loadEvents())}>
  <AdminSaleEventsScreen />
</SaleEventErrorBoundary>
```

Known codes (`SALE_ERROR_CODES`): `NOT_AUTHENTICATED`, `NOT_FOUND`,
`PERMISSION_DENIED`, `DUPLICATE_ENROLLMENT`, `SLUG_TAKEN`, `EVENT_INACTIVE`,
`REGISTRATION_CLOSED`, `INVALID_INPUT`, `NETWORK`, `UNKNOWN`. Classify yourself
with `classifySaleError(error)`.

---

## 8. Validation (Zod)

Store thunks already validate their inputs with `parseOrThrow`, so a bad payload
rejects the thunk with a joined, field-prefixed message. To validate in the UI
before dispatch, use the non-throwing runner:

```tsx
import { validate, createEventSchema } from '~/lib/sale-event'

const { success, data, errors } = validate(createEventSchema, formData)
if (!success) return toast.show(errors![0])
```

Schemas: `createEventSchema`, `updateEventSchema` (all optional),
`createEventOfferSchema`, `attachOfferCategoriesSchema`,
`attachOfferListingsSchema`, `categoryQuerySchema`, `listingPickerQuerySchema`,
`vendorEnrollSchema`, `updateEnrollmentStatusSchema`.

> Datetime fields accept `datetime-local` strings and are normalised to ISO.
> `category_id` is validated as **text** (categories use `'1'`, `'10'`, … not
> UUIDs); `listing_id` is a UUID.

---

## 9. Display helpers (`sale.utils`)

| Helper | Does |
|--------|------|
| `getCurrencySymbol(code)` | Symbol via the shared shop currency map |
| `formatDiscountLabel(type, value, currency?)` | `"20% off"` / `"₹100 off"` |
| `generateEventSlug(name)` | URL-friendly slug |
| `isEventActive` / `isEventExpired` / `isEventUpcoming` | Status checks by date window |
| `isRegistrationOpen(event)` / `getRegistrationLabel(event)` | Registration window state + label |
| `formatEventDate(date)` / `getEventDurationLabel(event)` | Display date + `"3 days left"` |
| `formatEventBanner(url)` | Banner URL with default fallback |
| `validateBannerFile(file)` | Type/size always; dimension + aspect-ratio on web only |
| `normalizeOfferPayload(payload)` | Coerce numeric offer fields before validation |
| `canWithdrawEnrollment` / `formatEnrollments` / `getEnrollmentStatusLabel` | Enrollment display helpers |

---

## 10. Banners

Upload happens in the service against the `sale-event-banners` bucket:

```tsx
import { uploadBannerImage } from '~/lib/sale-event'

const res = await uploadBannerImage(
  { blob, mimeType: 'image/jpeg', fileName: 'banner.jpg', fileSize: blob.size },
  eventId, // optional — scopes the storage path
)
if (res.success) setBannerUrl(res.data!.url) // store on the event's banner_image
```

Only admins can write to the bucket (RLS); anyone can read (public URLs).
Use `deleteBannerImage(publicUrl)` to remove a banner (external URLs are ignored).

---

## 11. Do / Don't

- ✅ Dispatch thunks/actions; read via `useAppSelector`.
- ✅ Trust optimistic updates — don't manually mutate lists or refetch after a write.
- ✅ Use `.unwrap()` when you need success/error toasts; `s.sale.error` is always friendly.
- ✅ Style flows with a **drawer** (BottomSheet / Sheet), not a modal/dialog, per the design direction.
- ❌ Don't call `sale.service.*` directly from components (bypasses the store/optimistic layer).
- ❌ Don't store `Blob`/`File` in Redux — pass them only as thunk/service args (banner upload).
```

