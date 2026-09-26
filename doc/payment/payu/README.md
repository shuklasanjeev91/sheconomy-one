# PayU / SHEPay — live multi-vendor bundle checkout

## Buyer flow

1. Multi-shop cart → `atomic_marketplace_checkout` creates **N orders** (one per shop).
2. Client calls `finalize_shepay_bundle_charge` → **one** SHEPay charge step with `metadata.allocations[]`.
3. Buyer pays once via live S2S (`shepay-payu-create` → `https://secure.payu.in/_payment`).
4. Webhook marks **all** allocated orders paid, then:
   - Shops **with** a connected child merchant → Automate **absolute `payment_split`** + **`release_settlement`** (immediate).
   - Shops **without** a child merchant → amount stays on the parent and is stored in `shepay_pending_settlements`.
5. When a vendor later connects SHEPay (`shepay-release-pending`), held rows are split + released automatically.

Buyers are **not** blocked if a shop has not connected PayU yet.

## Vendor setup

Vendors never open PayU. They submit payout details in shop settings (name, mobile, email, PAN, GST if they have it, bank account, IFSC, and KYC documents). An admin reviews the application and approves it. `shepay-create-child` then:

1. Gets a Hub token with scope `refer_child_merchant`.
2. Creates the child merchant (`POST /api/v3/product_accounts`).
3. Updates bank details (`PUT /api/v3/product_accounts/{uuid}`).
4. Reads the child key and MID (`fetch_child_merchants`), saves them, marks the shop verified, and releases held settlements.

Until that status is **PayU verified**, a new shop stays off the storefront. Shops that were already verified stay listed.

While the vendor types a GSTIN, the app checks the GST checksum, fills the PAN from that GSTIN, and calls `shepay-verify-kyc`. With `GST_VERIFY_TOKEN` and `GST_VERIFY_CLIENT_ID` set, that call reads the tax registry and shows the legal name, trade name, and Active status. A cancelled GSTIN or a PAN that does not match the GSTIN cannot be submitted.

`shepay-sync-child` remains the lookup used after create. It is not a vendor step.

### Hub secrets (required for auto-fetch)

| Secret | Purpose |
|--------|---------|
| `PAYU_HUB_CLIENT_ID` | Hub OAuth client id |
| `PAYU_HUB_CLIENT_SECRET` | Hub OAuth client secret |
| `PAYU_LIVE_MID` | Parent merchant MID for Sub Account Listing |
| `PAYU_HUB_BASE_URL` | Optional, default `https://accounts.payu.in` |
| `PAYU_ONBOARDING_BASE_URL` | Optional, default `https://onboarding.payu.in` |

Scopes on the Hub client: `fetch_child_merchants` and `refer_child_merchant` (required to create child merchants from admin approval).

## Vendor setup (legacy notes)

- SHEPay only (Via SHEconomy).
- Save **child merchant key** + **Child MID** (required for release).
- `shop_commerce_settings.payment_mode = shepay`.
- Until connected: sales still work; payouts show as **Amount on hold** and auto-transfer on connect.

## Secrets (live)

| Secret | Purpose |
|--------|---------|
| `PAYU_LIVE_MERCHANT_KEY` / `PAYU_MERCHANT_KEY` | Parent merchant key |
| `PAYU_LIVE_MERCHANT_SALT` / `PAYU_MERCHANT_SALT` | Parent salt |
| `PAYU_ENV=live` | Forced in code; secret kept for clarity |

## Deploy

```bash
npx supabase db push --project-ref zsaqrrzwygzwrlzgymxk
npx supabase functions deploy shepay-payu-create shepay-payu-bin shepay-payu-verify shepay-payu-webhook shepay-release-pending shepay-sync-child shepay-create-child --project-ref zsaqrrzwygzwrlzgymxk
```
