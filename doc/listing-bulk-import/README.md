# Bulk Listing Import — Developer Guide

Everything bulk-import-related lives in **`lib/listing/`** (logic) and
**`commerce/components/vendor/bulk-import/`** (UI). Vendors open the flow from
**Inventory → Products → Import** (`/vendor/products`).

> **TL;DR** — Download a template, upload CSV/XLSX on web, review row validation,
> then dispatch `startBulkImport()`. Each row runs through
> `listingPublishOrchestrator.publishListing()` with concurrency 2. Progress is
> tracked per row in Redux (`listingBulkImport` slice).

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/config/listing-image-import-rules.ts` | HTTPS image URL rules, host allowlist, template rule rows |
| `lib/listing/listing-bulk-import.type.ts` | Row/status types (`BulkImportRow`, `BulkImportRowStatus`, …) |
| `lib/listing/listing-bulk-import.constants.ts` | Concurrency, file limits, CSV template header/sample, field hints |
| `lib/listing/listing-bulk-import.errors.ts` | Parse + publish error mappers (`toBulkImportRowError`, …) |
| `lib/listing/listing-bulk-import.validation.ts` | **Zod** schema + file/name guards + `validateBulkImportRow()` |
| `lib/listing/listing-bulk-import.utils.ts` | Row normaliser, CSV/Excel parsers, template download, overall progress |
| `lib/listing/listing-bulk-import.store.ts` | Redux slice, thunks, selectors — **main entry point** |
| `lib/listing/listing-publish.orchestrator.ts` | Publish pipeline (already migrated — **do not duplicate**) |
| `commerce/components/vendor/bulk-import/BulkImportContent.tsx` | Full import UI (templates, drop zone, rows, actions) |
| `commerce/components/vendor/bulk-import/BulkImportDropZone.tsx` | Drag-and-drop / file picker (web) |
| `commerce/components/vendor/bulk-import/BulkImportRowCard.tsx` | Per-row status, progress bars, skip/retry |
| `commerce/components/vendor/bulk-import/BulkImportOverallProgress.tsx` | Aggregate progress bar |
| `commerce/screens/vendor/VendorBulkImportDrawer.tsx` | Right-side drawer shell (720px on desktop) |
| `commerce/screens/vendor/VendorListingsScreen.tsx` | Wires **Import** button + drawer on products tab |

The Redux `<Provider>` is already wired at the app root. The bulk-import slice is
**not persisted** — state resets when the drawer closes or on `resetBulkImport()`.

### Reuse note (no duplication)

| Concern | Delegates to |
|---------|--------------|
| Publish each row | `listingPublishOrchestrator.publishListing()` |
| Friendly listing errors | `toFriendlyListingError()` via `listing-bulk-import.errors.ts` |
| Listing type constants | `LISTING_TYPES` from `listing.type.ts` |
| Refresh product list after import | `loadShopListings()` from `listing.store.ts` |
| Image URL validation | `validateImportedListingImageUrl()` in `listing-image-import-rules.ts` |

---

## 2. The 30-second version

```tsx
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  parseBulkImportFileThunk,
  selectBulkImportSummary,
  startBulkImport,
} from '~/lib/listing/listing-bulk-import.store'

function BulkImportExample({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const { rows, pendingCount, isImporting } = useAppSelector(selectBulkImportSummary)

  async function onFile(file: File) {
    await dispatch(parseBulkImportFileThunk({ shopId, file })).unwrap()
  }

  async function onPublish() {
    await dispatch(startBulkImport()).unwrap()
  }

  return (
    <>
      {/* wire file input → onFile */}
      {pendingCount > 0 && !isImporting ? (
        <button onClick={onPublish}>Publish {pendingCount} listings</button>
      ) : null}
      {rows.map((row) => (
        <div key={row.id}>{row.publishData.title} — {row.status}</div>
      ))}
    </>
  )
}
```

For production UI, use `VendorBulkImportDrawer` + `BulkImportContent` instead of
rolling your own.

---

## 3. State shape

`useAppSelector((s) => s.listingBulkImport.<field>)` or `selectBulkImportSummary`.

| Field | Type | Meaning |
|-------|------|---------|
| `shopId` | `string \| null` | Target shop for all rows |
| `fileName` | `string \| null` | Last uploaded file name |
| `parseError` | `string \| null` | File parse failure (friendly) |
| `rows` | `BulkImportRow[]` | Normalised + validated rows |
| `isParsing` | `boolean` | CSV/XLSX parse in flight |
| `isImporting` | `boolean` | Publish batch in flight |
| `isComplete` | `boolean` | Last batch finished |
| `importError` | `string \| null` | Batch-level failure |
| `overall` | `BulkImportOverallProgress` | `{ total, processed, succeeded, failed, skipped, pct }` |

Each `BulkImportRow`:

| Field | Meaning |
|-------|---------|
| `id` | 1-based row number in the file |
| `publishData` | Normalised `PublishListingData` for the orchestrator |
| `status` | `pending` \| `publishing` \| `success` \| `failed` \| `skipped` |
| `validationErrors` | Pre-publish Zod errors (row marked `failed` immediately) |
| `currentStep` | Human label while publishing |
| `completedSteps` | Orchestrator steps finished |
| `progressPct` | 0–100 per-row progress |
| `error` | Runtime publish error (after validation passed) |
| `listingId` | Set on success |

---

## 4. How progress works (not optimistic)

Unlike shop mutations, bulk import does **not** optimistically insert listings.
Each row is published through the orchestrator; the UI updates as steps complete:

1. **`parseBulkImportFileThunk`** — parse file → `buildBulkImportRows()` → Zod validate each row.
2. **`startBulkImport`** — batches pending rows (concurrency **2**), calls orchestrator per row.
3. **`patchBulkImportRow`** — step callbacks update `currentStep`, `completedSteps`, `progressPct`.
4. On success → row status `success`, `listingId` set. On failure → friendly `error` via `toBulkImportRowError()`.

After a successful batch, `BulkImportContent` dispatches `loadShopListings()` and
shows a toast. `VendorListingsScreen` bumps `refreshNonce` so the products tab refetches.

---

## 5. Async thunks

All imported from `~/lib/listing/listing-bulk-import.store`.

| Thunk | Arg | Does |
|-------|-----|------|
| `parseBulkImportFileThunk` | `{ shopId, file: File }` | Validates file name/size, parses CSV/XLSX, builds rows |
| `startBulkImport` | — | Publishes all `pending` rows (concurrency 2) |
| `retryFailedBulkImport` | — | Resets runtime-failed rows to `pending`, then `startBulkImport` |

---

## 6. Sync actions

| Action | Arg | Does |
|--------|-----|------|
| `setBulkImportShopId` | `string \| null` | Bind target shop |
| `resetBulkImport` | — | Clear file/rows (keeps `shopId`) |
| `skipBulkImportRow` | `rowId: number` | Mark pending row as skipped |
| `resetBulkImportRow` | `rowId: number` | Reset skipped/failed row to pending |
| `patchBulkImportRow` | `{ id, patch?, patchFn? }` | Internal row updates (also used by orchestrator callbacks) |

---

## 7. Selectors

```tsx
import { selectBulkImportSummary } from '~/lib/listing/listing-bulk-import.store'

const {
  rows,
  overall,
  isImporting,
  isComplete,
  parseError,
  importError,
  fileName,
  hasRows,
  pendingCount,
  failedRuntimeCount,
  invalidCount,
} = useAppSelector(selectBulkImportSummary)
```

---

## 8. Validation (Zod)

Spreadsheet rows are normalised in `normaliseBulkImportRow()` then validated with
`bulkImportPublishDataSchema` (coerces string numbers from form-shaped data).

**Required before publish:**

- Title 3–200 chars, description present
- `listing_type`: `physical` \| `digital` \| `service`
- At least one HTTPS image URL (approved host + `.jpg`/`.jpeg`/`.png`)
- **Physical:** `stock`, ≥1 material, ≥1 variation
- **Digital:** `digital_file_url`
- **Service:** `booking_duration_minutes`

**File guards:**

- Extensions: `.csv`, `.xlsx`, `.xls`
- Max size: 10 MB (`BULK_IMPORT_CONFIG.MAX_FILE_BYTES`)

**Known gap:** The `category` CSV column is stored as text but not mapped to
category UUIDs (`categories: []`). Category assignment via bulk import is not
yet supported.

---

## 9. Template download

```tsx
import {
  downloadBulkImportCsvTemplate,
  downloadBulkImportExcelTemplate,
} from '~/lib/listing/listing-bulk-import.utils'

downloadBulkImportCsvTemplate()           // sync
await downloadBulkImportExcelTemplate()   // Excel with Listings + Rules sheets
```

Excel template includes image host allowlist in the **Rules** sheet (from
`getListingImageImportTemplateRuleRows()`).

---

## 10. UI entry points

### Vendor (primary)

`/vendor/products` → **Import** button → `VendorBulkImportDrawer`.

```tsx
<VendorBulkImportDrawer
  ui={ui}
  open={bulkImportOpen}
  isDesktop={isDesktop}
  shopId={shop.id}
  safeBottom={safeBottom}
  onClose={() => setBulkImportOpen(false)}
  onImportComplete={() => setProductsRefreshNonce((n) => n + 1)}
/>
```

### Admin / custom shop

Reuse `BulkImportContent` or the drawer with any `shopId` the user can manage.
Gate with `canManageShop(shop, userId, role)` from `shop.utils` before opening.

### Native (iOS/Android)

Bulk import is **web-only** for file upload. `BulkImportContent` shows an
informational message on native; no crash, no broken picker.

---

## 11. Error messages

| Stage | Source | Example |
|-------|--------|---------|
| Parse | `formatBulkImportParseError` | "Could not parse file: …" |
| Pre-publish | Zod / `validationErrors` | "stock is required for physical listings" |
| Publish | `toBulkImportRowError` | "Slug already exists…", "Image URL is invalid…" |
| Batch | `importError` on thunk reject | "No shop selected." |

Duplicate slug and invalid image URL errors are mapped to actionable copy in
`listing-bulk-import.errors.ts`.

---

## 12. Common recipes

**Open drawer from a custom screen**

```tsx
const [open, setOpen] = useState(false)
// …
<VendorBulkImportDrawer shopId={shopId} open={open} onClose={() => setOpen(false)} … />
```

**Embed content without drawer**

```tsx
<BulkImportContent ui={ui} shopId={shopId} isDesktop={isDesktop} onImportComplete={refetch} />
```

**Reset on drawer close**

`VendorBulkImportDrawer` dispatches `resetBulkImport()` on close so the next
open starts fresh.

**Skip / retry single rows**

```tsx
dispatch(skipBulkImportRow(rowId))
dispatch(resetBulkImportRow(rowId))  // then user clicks Publish again
dispatch(retryFailedBulkImport())   // retry all runtime failures
```

---

## 13. Do / Don't

- ✅ Use Redux thunks/actions; read via `selectBulkImportSummary`.
- ✅ Download templates so vendors get column names + image rules.
- ✅ Keep publish logic in the orchestrator — bulk import only normalises + validates rows.
- ✅ Show validation errors per row before the user clicks Publish.
- ✅ Refresh listings after import (`loadShopListings` + local tab refetch).
- ❌ Don't call `listingPublishOrchestrator` directly from UI components.
- ❌ Don't store `File` blobs in Redux — pass files only as thunk args.
- ❌ Don't expect category assignment from the CSV `category` column yet.
- ❌ Don't enable file upload on native without a platform-specific picker strategy.

---

## 14. Migration notes (old → new)

| Old (`E:\sheconomy\`) | New |
|-----------------------|-----|
| `stores/listingBulkImportStore.js` (Zustand) | `lib/listing/listing-bulk-import.store.ts` (Redux) |
| `components/vendor/BulkListingImport.jsx` | `BulkImportContent` + drawer components |
| `lib/config/image-upload-rules.js` | `lib/config/listing-image-import-rules.ts` |
| Modal UI | Right-side drawer (`VendorBulkImportDrawer`) |
| Inline XLSX via dynamic import | `exceljs` (same pattern, typed) |

The orchestrator was migrated separately — see `doc/listing/` (if present) or
`listing-publish.orchestrator.ts` inline docs.
