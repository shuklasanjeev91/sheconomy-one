# Vendor Payment Gateway — Developer Guide

Everything for **shop payment gateway setup** (connect providers, settings, logs)
lives in **`lib/payment/`** and is registered in Redux as **`vendorPayment`**.

> **Scope distinction**
> - **`lib/payment/`** → vendor/admin gateway accounts, settings, logs (`shop_payment_accounts`, `vendor_payment_settings`, `payment_logs`)
> - **`lib/orders/payment.*`** → checkout order payments (`order_payments`) — already migrated; Redux key `payment`

> **TL;DR** — Vendor settings → **Payment Methods** uses `VendorPaymentMethodsPanel` + connect drawer. Dispatch thunks from `payment.store.ts`; connect/disconnect/settings mutations are **optimistic** with rollback on failure.

---

## UI entry points

| File | Role |
|------|------|
| `commerce/screens/vendor/VendorPaymentSettings.tsx` | Settings section shell (title + layout), like Connect |
| `commerce/screens/vendor/VendorPaymentMethodsPanel.tsx` | Dashboard: summary cards, provider grid, drawer state |
| `commerce/screens/vendor/VendorPaymentConnectDrawer.tsx` | Right-side drawer shell (web + native) |
| `commerce/components/vendor/payment/PaymentProviderCard.tsx` | Provider card with badge + CTA |
| `commerce/components/vendor/payment/PaymentConnectForm.tsx` | Credential form, mode toggle, validation, connect/disconnect |
| `commerce/components/vendor/payment/PaymentSummaryCards.tsx` | Connected count, setup status, PCI badge |
| `lib/payment/payment-ui.copy.ts` | Centralised UI strings (no hardcoded copy in components) |

**Route:** Vendor settings → `?section=payments` (`VendorSettingsScreen` → `VendorPaymentSettings`, same pattern as Connect).

**Load on mount:** `setVendorPaymentShopId` → `initializePaymentSetup` (first visit) or refresh accounts/settings/setup status.

**Connect flow:** `validateProviderCredentialForm()` → `savePaymentCredentials` (optimistic) → optional `updatePaymentSettings` for webhook URL.

**Validation check:** Client-side Zod/field validation only (`Run validation check` button) — no live $0 auth call yet.

---

## 1. Architecture review (legacy)

### Legacy flow

```
Vendor UI (PaymentSettingsPage)
    ↓
Zustand paymentStore.js
    ↓
┌─────────────────────────┬──────────────────────────┬─────────────────────┐
│ payment-account-service │ payment-settings-service │ payment-log-service │
└─────────────────────────┴──────────────────────────┴─────────────────────┘
    ↓
Supabase tables: shop_payment_accounts, vendor_payment_settings, payment_logs, payment_webhooks
    ↓
RPC: get_shop_payment_status(shop_uuid)
```

### Responsibilities

| Layer | Role |
|-------|------|
| `payment-utils.js` | 45+ provider catalog, credential field defs, region helpers, formatting |
| `paymentStore.js` | Load accounts/settings/logs, connect OAuth/credentials, setup status |
| Account service | CRUD on `shop_payment_accounts`, credential storage in `metadata` |
| Settings service | `vendor_payment_settings` upsert + validation |
| Log service | `payment_logs` + analytics aggregation + webhooks |

### Multi-role usage

| Role | Usage |
|------|-------|
| **Vendor** | Connect providers for own shop, configure settlement/webhooks |
| **Admin** | Same store — pass `shopId` for any shop (RLS + `canManageShop` gating in UI) |
| **Buyer** | Does **not** use this module; checkout reads sanitized shop methods separately |

---

## 2. Migration plan (file mapping)

| Old | New |
|-----|-----|
| `lib/utils/payment-utils.js` (constants) | `lib/payment/payment.constants.ts` |
| `lib/utils/payment-utils.js` (provider catalog) | `lib/payment/payment.providers.config.ts` |
| `lib/utils/payment-utils.js` (helpers) | `lib/payment/payment.utils.ts` |
| `payment-account-service.js` | `lib/payment/payment.service.ts` (account section) |
| `payment-settings-service.js` | `lib/payment/payment.service.ts` (settings section) |
| `payment-log-service.js` | `lib/payment/payment.service.ts` (logs section) |
| `stores/paymentStore.js` (Zustand) | `lib/payment/payment.store.ts` (Redux `vendorPayment`) |
| Inline validation in settings service | `lib/payment/payment.validation.ts` (Zod) |
| Ad-hoc error strings | `lib/payment/payment.errors.ts` |

---

## 3. File map

| File | Purpose |
|------|---------|
| `payment.constants.ts` | Enums, regions, currencies, defaults, DB alias map |
| `payment.providers.config.ts` | `PROVIDER_CREDENTIAL_FIELDS`, `PAYMENT_PROVIDERS_CONFIG` (1:1 catalog) |
| `payment.type.ts` | DB row types + domain inputs/outputs |
| `payment.errors.ts` | `PaymentError`, `toFriendlyPaymentError()`, codes |
| `payment.validation.ts` | Zod settings schema, credential validation |
| `payment.utils.ts` | Provider helpers, analytics, formatting |
| `payment.service.ts` | Supabase data access (all three legacy services) |
| `payment.store.ts` | Redux thunks + optimistic mutations |
| `index.ts` | Barrel exports |

Redux registration: `vendorPayment: vendorPaymentReducer` in `lib/store/index.ts`.

---

## 4. State shape

`useAppSelector((s) => s.vendorPayment.<field>)`

| Field | Meaning |
|-------|---------|
| `shopId` | Active shop context |
| `paymentAccounts` | Rows from `shop_payment_accounts` |
| `connectedProviders` | Normalised `{ provider, connectedAt }[]` |
| `paymentSettings` | `vendor_payment_settings` row (or defaults) |
| `paymentSetupStatus` | From RPC `get_shop_payment_status` |
| `paymentLogs` / `logsHasMore` | Paginated log rows |
| `paymentAnalytics` | Aggregated log metrics |
| `logFilters` | eventType, status, provider, dates, pagination |
| `loading.*` | Per-domain in-flight flags |
| `error` | Last friendly error |

---

## 5. Thunks (dispatch these)

| Thunk | Purpose |
|-------|---------|
| `loadPaymentAccounts({ shopId })` | Accounts + connected providers |
| `connectPaymentAccount({ shopId, provider, merchantId, tokens? })` | OAuth connect (optimistic) |
| `savePaymentCredentials({ shopId, provider, credentials, mode? })` | API-key providers (optimistic) |
| `disconnectPaymentAccount({ shopId, provider? })` | Disconnect one or all (optimistic) |
| `loadPaymentSettings({ shopId })` | Load settings |
| `updatePaymentSettings({ shopId, settings })` | Patch settings (optimistic) |
| `togglePaymentLiveMode({ shopId, isLiveMode })` | Live/sandbox toggle (optimistic) |
| `checkPaymentSetupStatus({ shopId })` | Refresh setup status |
| `initializePaymentSetup({ shopId })` | Default settings + initial load |
| `loadPaymentLogs({ shopId })` | Uses `logFilters` from state |
| `loadPaymentAnalytics({ shopId, timeRange? })` | 30-day default window |
| `logPaymentEvent(input)` | Append log (+ optional log refresh) |

Sync actions: `setVendorPaymentShopId`, `updateLogFilters`, `clearLogFilters`, `resetVendorPayment`, `clearVendorPaymentError`.

---

## 6. Quick usage

```tsx
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import {
  loadPaymentAccounts,
  loadPaymentSettings,
  savePaymentCredentials,
  selectVendorPaymentAccounts,
} from '~/lib/payment/payment.store'

export function VendorPaymentPanel({ shopId }: { shopId: string }) {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectVendorPaymentAccounts)

  useEffect(() => {
    void dispatch(loadPaymentAccounts({ shopId }))
    void dispatch(loadPaymentSettings({ shopId }))
  }, [dispatch, shopId])

  async function connectPaystack(keys: Record<string, string>) {
    await dispatch(
      savePaymentCredentials({ shopId, provider: 'paystack', credentials: keys, mode: 'sandbox' }),
    ).unwrap()
  }

  return null // UI later — drawer will call the same thunks
}
```

---

## 7. Validation

- **Settings** — `paymentSettingsSchema` (Zod): currency code, FX markup 0–10%, HTTPS webhook URL, settlement schedule enum
- **Credentials** — `validateProviderCredentials()` / `validateProviderCredentialForm()` using `PROVIDER_CREDENTIAL_FIELDS`
- **Connect** — `connectPaymentAccountSchema` / `savePaymentCredentialsSchema`

---

## 8. Provider catalog notes

- Full 45+ provider metadata migrated to `payment.providers.config.ts`
- OAuth providers hidden in vendor UI unless `EXPO_PUBLIC_SHOW_OAUTH_PROVIDERS=true`
- Some catalog ids are **not yet on the DB enum** (`CATALOG_ONLY_PAYMENT_PROVIDERS`): SheconomyPay, COD, bank transfer, Instamojo, Klarna, Billplz, Telr — connect attempts return a friendly `PROVIDER_UNSUPPORTED` error until enum migration
- Alias map (`PAYMENT_PROVIDER_DB_ALIASES`) handles naming differences (e.g. `authorize_net` → `authorizenet`)

---

## 9. Improvements over legacy

| Area | Improvement |
|------|-------------|
| State | Zustand → Redux Toolkit with typed thunks/selectors |
| Validation | Ad-hoc checks → Zod schemas + reusable credential validation |
| Errors | Raw Supabase messages → classified `PaymentError` + friendly copy |
| Types | Untyped JS → DB-generated row types + domain interfaces |
| Optimistic UI | None in Zustand → rollback snapshots on connect/disconnect/settings |
| Separation | Monolithic utils → constants / providers config / utils / service |
| Naming | Clarified vs order payments (`vendorPayment` vs `payment`) |
| Env | `NEXT_PUBLIC_*` + `EXPO_PUBLIC_*` for OAuth visibility flag |

---

## 10. Do / Don't

- ✅ Dispatch thunks; read `vendorPayment` slice
- ✅ Use `validateProviderCredentials()` before save
- ✅ Gate admin UI with `canManageShop()` from `shop.utils`
- ✅ Use `PaymentErrorBoundary` around vendor payment panels
- ✅ Use `validateProviderCredentialForm()` for field-level drawer errors
- ❌ Don't confuse with `lib/orders/payment.store.ts` (order checkout)
- ❌ Don't call `payment.service` directly from components
- ❌ Don't store raw credentials in Redux — only in Supabase `metadata` via service

---

## 11. Direct provider checkout (Razorpay)

**Razorpay** is the first fully wired **seller-direct** provider:

1. Vendor connects via credential form (Key ID + Secret) — not OAuth stub
2. `savePaymentCredentials` syncs `shop_commerce_settings.payment_mode = direct`
3. Checkout uses `razorpay-direct-create` → Payment Link → webhook

See **[doc/payment/razorpay/README.md](../razorpay/README.md)** for the full flow,
webhook URL, and how to add Stripe/Cashfree the same way.
