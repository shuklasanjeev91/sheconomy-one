# SHEPay / PayU Merchant Hosted Checkout

SHEPay collects marketplace payments through PayU’s **Merchant Hosted** `_payment` form POST on **web and native** (iOS/Android WebView bridge).

Docs: [Custom Checkout (Merchant Hosted)](https://docs.payu.in/docs/custom-checkout-merchant-hosted)

## Flow (web + native)

1. Buyer places an online order with SHEPay collection.
2. Edge function `shepay-payu-create` builds a signed PayU form (key, txnid, amount, hash, surl/furl).
3. App opens `/orders/payu`:
   - **Web:** hidden form auto-POST to PayU.
   - **Native:** same HTML loaded in `WebView`; return URLs intercepted to `/orders/payu-return`.
4. PayU shows enabled methods (or a preferred `pg` / `bankcode` when the buyer preselects one).
5. Webhook `shepay-payu-webhook` confirms status (accepts **test or live** salt).

**PCI note:** Card PAN/CVV are **not** collected in the SHEconomy app. PayU hosts those fields.

## Credentials (from PayU Dashboard → Developer → API Keys)

| Env | MID | Endpoint |
|-----|-----|----------|
| **Live** | `13665697` | `https://secure.payu.in/_payment` |
| **Test** | `9267496` | `https://test.payu.in/_payment` |

Toggle **Test Mode / Live Mode** in the PayU header to see each key/salt pair.

### Supabase secrets

Never commit key/salt. Set on project `zsaqrrzwygzwrlzgymxk`:

```bash
npx supabase secrets set \
  PAYU_ENV=live \
  PAYU_LIVE_MERCHANT_KEY='…' \
  PAYU_LIVE_MERCHANT_SALT='…' \
  PAYU_LIVE_MID='13665697' \
  PAYU_TEST_MERCHANT_KEY='…' \
  PAYU_TEST_MERCHANT_SALT='…' \
  PAYU_TEST_MID='9267496' \
  PAYU_MERCHANT_KEY='…' \
  PAYU_MERCHANT_SALT='…' \
  PAYU_BASE_URL='https://secure.payu.in' \
  --project-ref zsaqrrzwygzwrlzgymxk
```

| Secret | Purpose |
|--------|---------|
| `PAYU_ENV` | `live` (production / App Store) or `test` (sandbox) |
| `PAYU_LIVE_*` | Live key / salt / MID |
| `PAYU_TEST_*` | Test key / salt / MID |
| `PAYU_MERCHANT_KEY` / `SALT` | Fallback (usually same as live) |
| `PAYU_BASE_URL` | Live endpoint override |

Redeploy after secret changes:

```bash
npx supabase functions deploy shepay-payu-create shepay-payu-webhook --project-ref zsaqrrzwygzwrlzgymxk
```

Webhook URL (configure in PayU Dashboard → Developer → Webhooks for **both** Test and Live):

`https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/shepay-payu-webhook`

## Payment methods (`pg` / `bankcode`)

| Method | pg | bankcode | Notes |
|--------|----|----------|-------|
| All (default) | _(omit)_ | — | PayU shows every method enabled on the dashboard |
| Cards | `CC` | `CC` | Visa / MC / Amex etc. on PayU page |
| Net Banking | `NB` | bank-specific | |
| Wallets | `CASH` | wallet code | Paytm, PhonePe, etc. |
| UPI | `UPI` | — | |
| UPI Intent | `UPI` | `INTENT` | |
| UPI / Store QR | `UPI` | `UPIDBQR` | |
| EMI | `EMI` | plan/bank | |
| BNPL | `BNPL` | provider | |
| PayPal | `PAYPAL` | — | Activate in PayU Dashboard |
| Pluxee (Sodexo) | `MC` | `SODEXO` | |
| NEFT/RTGS | `NEFTRTGS` | `EFTAXTPV` | `api_version=6` |

Enable each method under **PayU Dashboard → Payment Gateway** (per Test/Live mode).

## Checkout UX

Checkout chips under **Pay online** set `mode` → edge function maps to `pg`/`bankcode`. Default **All** omits `pg` so PayU’s full picker is used.
