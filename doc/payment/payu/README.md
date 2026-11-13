# PayU / SHEPay — live multi-vendor bundle checkout

## Buyer flow

1. Cart groups line items **by shop** (cart + checkout UI).
2. Single Pay → Edge Function `commerce-create-checkout` (idempotency key):
   - Validates cart, stock, and seller KYC (every shop must be `payu_verified`).
   - Calls `atomic_marketplace_checkout` → **one** `commerce_checkout_groups` row + **N** child orders (items + `order_delivery` + inventory reservations) + **N** per-shop payment steps (`platform_fee_amount: 0`).
   - Per-shop shipping from delivery profiles / Easyship DDP is included in the seller absolute split (0% platform fee). Sellers self-fund `easyship_shipping_credits`; labels debit that wallet.
   - Online SHEPay: `finalize_shepay_bundle_charge` → one charge step with `metadata.allocations[]`.
3. Buyer pays once via hosted/S2S (`shepay-payu-create` → txnid + hash → `https://secure.payu.in/_payment`).
4. Public webhook `shepay-payu-webhook` (reverse-hash verified, idempotent):
   - Marks checkout **paid**, confirms N child orders, stamps **platform fee = 0**, converts inventory reservations, notifies sellers.
   - Shops **with** a connected child → Automate absolute **`payment_split`** (aggregator charges = 0). Funds stay **held** at PayU — **no** `release_settlement` yet.
   - Every shop allocation gets a `shepay_pending_settlements` row (`awaiting_release_window` or `awaiting_child`).
   - On payment **failure** → checkout cancelled, orders cancelled, reservations released.
5. **Release** (`shepay-release-settlement`, hourly cron): only when order is delivered, return window elapsed, and there is **no open dispute**. Then `release_settlement`.
   - Open `order_issues` set `hold_reason=dispute` (blocks release); closing clears the block.
   - Refunds (`process-refund`) call PayU with split/child details and mark settlements `refunded`.
   - Connecting a child (`shepay-release-pending`) attaches keys and runs eligibility release — not an immediate payout.

### Order gating (mandatory KYC)

Every shop must have a `shop_payu_kyc` row with status **`payu_verified`** before it can accept orders.
Missing KYC is treated the same as incomplete KYC.

- Server: `shop_payu_kyc_allows_orders` inside `atomic_marketplace_checkout` / referral first-sale helpers
- Edge check in `commerce-create-checkout`
- Storefront: listings require `shops.verified` (set only when KYC sync activates; cleared for non-verified shops)
- Vendor hub: banner + publish blocked until `payu_verified`

## Vendor setup (zero PayU touchpoint)

Vendors never open PayU. They submit payout details in **Verification** (`/vendor/settings?section=verification`):

- **Legal name** (PayU `name`) vs **Trade / business name** (storefront) — not a trademark certificate
- Business type is a grouped dropdown (PayU `business_entity_id`), auto-inferred from
  GST constitution (`ctb`) or PAN 4th letter when possible:
  - Person: Individual (14), Sole Prop (2), HUF (10)
  - Firm: Partnership (3), LLP (6)
  - Company: Private Limited (4), Public Limited / Corporation (5), OPC (16)
  - Nonprofit: AOP (1), Society (8), Trust (7), NGO (15)
- GSTIN-first autofill: registry fills PAN, legal/trade names, and business type
- Entity fields: CIN (companies), LLPIN (LLP), registration number (society / trust / NGO / AOP)
- **PayU baseline docs:** PAN, bank proof, **signed Schedule C**, optional GST
- **Admin-only entity docs** (not uploaded to PayU): Certificate of Incorporation, partnership deed / LLP agreement / trust deed / society / NGO / AOP cert, optional govt ID for person entities

Stored in private bucket `shop-kyc-documents`; metadata in `shop_kyc_documents` (+ path columns on `shop_payu_kyc` for PayU kinds). Entity IDs live on `shop_payu_kyc.cin` / `llpin` / `registration_number`.

Admin reviews via **/admin/payu-kyc** (queue) or the shop panel. Approve runs `shepay-create-child`:

1. Hub token (`refer_child_merchant`)
2. Create child merchant (`POST /api/v3/product_accounts`)
3. Update bank details
4. Upload **only** PAN / bank / Schedule C / GST (Partner KYC Document API, with onboarding fallback) — entity docs stay admin-side
5. Store child key + MID on `shop_payment_accounts` with status **`pending`**
6. Mark `shop_payu_kyc.status = payu_pending` — **does not** set `shops.verified` yet

### Daily pending-KYC reminders

`process_payu_kyc_reminders` (pg_cron `30 4 * * *` UTC ≈ 10:00 IST):

- Targets active shops that are not `payu_verified` (including shops with no KYC row yet)
- Creates `payu_kyc_reminder` notifications (**in_app + push + email**), deduped ~23h per shop
- Copy states selling is blocked until KYC is verified; CTA → `/vendor/settings?section=verification`
- `process_payu_kyc_reminders(limit, true)` force-sends immediately (5-minute dedupe only)
- Delivery goes through `dispatch-notifications` (immediate push trigger + 5-minute cron)

### KYC status sync (every 6 hours)

`shepay-sync-kyc` (cron secret):

| PayU state | SHEconomy action |
|---|---|
| Active / onboarding complete | `payu_verified`, `shops.verified=true`, `payment_connected=true`, release held settlements, notify `payu_kyc_active` |
| Rejected docs | `changes_requested`, notify `payu_kyc_rejected` (seller re-uploads in SHEconomy) |

While the vendor types a GSTIN, the app checks the GST checksum, fills the PAN from that GSTIN, and calls `shepay-verify-kyc`.

`shepay-sync-child` remains the legacy EasyConnect lookup. New sellers use the KYC wizard only.

### Hub secrets (required for auto-fetch)

| Secret | Purpose |
|--------|---------|
| `PAYU_HUB_CLIENT_ID` | Hub OAuth client id |
| `PAYU_HUB_CLIENT_SECRET` | Hub OAuth client secret |
| `PAYU_LIVE_MID` | Parent merchant MID for Sub Account Listing |
| `PAYU_HUB_BASE_URL` | Optional, default `https://accounts.payu.in` |
| `PAYU_ONBOARDING_BASE_URL` | Optional, default `https://onboarding.payu.in` |
| `PAYU_PARTNER_BASE_URL` | Optional, default `https://partner.payu.in` |
| `NOTIFICATION_CRON_SECRET` | Auth for `shepay-sync-kyc` cron |

Scopes on the Hub client: `fetch_child_merchants` and `refer_child_merchant`.

## Secrets (live)

| Secret | Purpose |
|--------|---------|
| `PAYU_LIVE_MERCHANT_KEY` / `PAYU_MERCHANT_KEY` | Parent merchant key |
| `PAYU_LIVE_MERCHANT_SALT` / `PAYU_MERCHANT_SALT` | Parent salt |
| `PAYU_ENV=live` | Forced in code; secret kept for clarity |

## Deploy

```bash
npx supabase db push --project-ref zsaqrrzwygzwrlzgymxk
npx supabase functions deploy commerce-create-checkout shepay-payu-create shepay-payu-bin shepay-payu-verify shepay-payu-webhook shepay-payu-return shepay-release-settlement shepay-release-pending process-refund shepay-sync-child shepay-create-child shepay-sync-kyc shepay-verify-kyc --project-ref zsaqrrzwygzwrlzgymxk
```
