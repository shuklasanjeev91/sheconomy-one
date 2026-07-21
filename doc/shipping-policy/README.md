# Shop Shipping Policy — Developer Guide

Shop-level shipping configuration lives in **`lib/shipping-policy/`** and maps to the
`delivery_profiles` / `listing_delivery_profiles` tables. This is the vendor **delivery
profile** feature from the legacy app (fixed/variable rates, zones, processing times) —
not order fulfillment (`lib/orders/delivery.*`) or courier account rails (`commerce/lib/shop-shipping.ts`).

> **TL;DR** — Dispatch thunks from `shipping-policy.store`. Mutations are optimistic with
> safe rollback. Errors are friendly via `toFriendlyShippingPolicyError()`.

---

## 1. File map

| File | Purpose |
|------|---------|
| `shipping-policy.constants.ts` | Rate types, zone types, limits, defaults, success messages |
| `shipping-policy.type.ts` | Supabase-aligned types, zones/rates, access context |
| `shipping-policy.errors.ts` | `ShippingPolicyError`, codes, legacy `error_code` mapping |
| `shipping-policy.validation.ts` | Zod schemas + zone/rate validation |
| `shipping-policy.utils.ts` | Sort, format, defaults, zone helpers, checkout calculator |
| `shipping-policy.service.ts` | Supabase CRUD + listing assignment |
| `shipping-policy.store.ts` | Redux thunks + optimistic rollback |
| `shipping-policy-ui.copy.ts` | Vendor UI strings (no hardcoded copy in components) |
| `shipping-policy-ui.utils.ts` | Form mappers, rate display, zone builders |
| `index.ts` | Barrel exports |

### Vendor UI (`?section=shipping`)

| File | Purpose |
|------|---------|
| `commerce/screens/vendor/VendorShippingPolicySettings.tsx` | Settings shell |
| `commerce/screens/vendor/VendorShippingPolicyHubPanel.tsx` | List + CRUD hub |
| `commerce/components/vendor/shipping-policy/ShippingPolicyFormDrawer.tsx` | Create/edit drawer |
| `commerce/components/vendor/shipping-policy/ShippingPolicyFormFields.tsx` | Delivery profile form (fixed/variable, processing, toggles) |
| `commerce/components/vendor/shipping-policy/ShippingZoneManager.tsx` | Variable rate tiers |
| `commerce/components/vendor/shipping-policy/ShippingPolicyListItem.tsx` | Profile card |
| `commerce/components/ShippingPolicyErrorBoundary.tsx` | Hub error boundary |

Redux key: **`shippingPolicy`**

### Scope (what this module owns)

| Included | Excluded |
|----------|----------|
| Shop delivery profile CRUD | Courier/provider accounts (`shop_shipping_*`) |
| Shipping zones + rates JSON | Order tracking / fulfillment dispatch |
| Listing ↔ profile assignment | Platform SHEDelivery rail selection |
| `calculateShippingCharge()` for profile-based fees | Full checkout pipeline |

### Reuse / integration

| Concern | Delegates to |
|---------|--------------|
| Shop ownership / admin | `canManageShop()` from `~/lib/shop/shop.utils` |
| Country codes for zones | `~/lib/geo` (`getAllGeoCountries`, `resolveCountryCode`) |
| Buyer-facing display types | `~/commerce/lib/listing-fulfillment.ts` (`DeliveryProfile`) |

---

## 2. Quick example

```tsx
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadShippingPolicies,
  createShippingPolicy,
  selectSortedShippingPolicies,
  getShopLevelShippingPolicyInput,
} from '~/lib/shipping-policy'

dispatch(loadShippingPolicies({ shopId }))
dispatch(
  createShippingPolicy({
    shopId,
    input: getShopLevelShippingPolicyInput(shopCountry),
  }),
)
```

---

## 3. Thunks

| Thunk | Purpose |
|-------|---------|
| `loadShippingPolicies({ shopId, forceRefresh? })` | Fetch shop profiles (default first) |
| `createShippingPolicy({ shopId, input, accessContext? })` | Create profile |
| `updateShippingPolicy({ policyId, input, accessContext? })` | Update profile |
| `deleteShippingPolicy({ policyId, accessContext? })` | Delete profile |
| `loadListingShippingPolicies({ listingId, forceRefresh? })` | Profiles assigned to listing |
| `assignShippingPolicyToListing({ listingId, deliveryProfileId, accessContext? })` | Link profile |
| `removeShippingPolicyFromListing({ listingId, deliveryProfileId, accessContext? })` | Unlink profile |

---

## 4. Legacy migration mapping

| Old (`sheconomy`) | New (`sheconomy-one`) |
|-------------------|------------------------|
| `deliveryProfilesService` | `shipping-policy.service.ts` |
| `listingProfileStore` delivery slice | `shipping-policy.store.ts` |
| `validateDeliveryProfile` | `shipping-policy.validation.ts` |
| `shippingZoneUtils.js` | Zone/rate validation + utils in validation/utils |
| `shipping-calculator.js` | `calculateShippingCharge()` in utils |
| `formatDeliveryProfile` / `sortDeliveryProfiles` | `formatShippingPolicy` / `sortShippingPolicies` |
| `getDefaultDeliveryProfile` | `getDefaultShippingPolicy()` / `getShopLevelShippingPolicyInput()` |

**UI reference only (not migrated):** `DeliveryProfileForm.js`, `DeliveryProfilesSection.js`, `ShippingZoneManager.js`

---

## 5. Validation rules (1:1 from legacy)

- Profile name required, max 100 chars
- Processing time min ≥ 1, max ≥ min, max ≤ 365 days
- Free shipping threshold ≥ 0 when set
- `shipping_rate_type`: `fixed` | `variable` | `free`
- Zones: at least one country, no duplicate countries across zones, valid ISO codes
- Rates: fee ≥ 0, valid order ranges, no overlapping tiers

---

## 6. Improvements over legacy

- TypeScript types aligned with Supabase `delivery_profiles`
- Zod validation replacing manual string arrays
- Centralised error handling with legacy code mapping
- Admin reuse via `ShippingPolicyAccessContext` + `canManageShop()`
- Geo-backed country validation (not hardcoded country lists)
- Redux optimistic updates with explicit rollback registry
- Constants file — no magic numbers in service/store
- Vendor shipping settings UI at `/vendor/settings?section=shipping` (delivery profiles)
