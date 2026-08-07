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

## Vendor setup (easy)

1. Vendor taps **Connect SHEPay** → **Open PayU setup** (same email/phone + shop code if asked).
2. Vendor taps **Fetch my details & activate**.
3. `shepay-sync-child` uses PayU Hub (`fetch_child_merchants`) to pull **pg_key** + **mid**, saves them, sets platform webhook, and releases held settlements.

Manual paste of key/MID remains available as a fallback.

### Hub secrets (required for auto-fetch)

| Secret | Purpose |
|--------|---------|
| `PAYU_HUB_CLIENT_ID` | Hub OAuth client id |
| `PAYU_HUB_CLIENT_SECRET` | Hub OAuth client secret |
| `PAYU_LIVE_MID` | Parent merchant MID for Sub Account Listing |
| `PAYU_HUB_BASE_URL` | Optional, default `https://accounts.payu.in` |
| `PAYU_ONBOARDING_BASE_URL` | Optional, default `https://onboarding.payu.in` |

Scopes on the Hub client: `fetch_child_merchants` (required), `refer_child_merchant` (optional for future create flow).

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
npx supabase functions deploy shepay-payu-create shepay-payu-bin shepay-payu-verify shepay-payu-webhook shepay-release-pending shepay-sync-child --project-ref zsaqrrzwygzwrlzgymxk
```
