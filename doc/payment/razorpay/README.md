# Razorpay (Direct Seller Checkout)

Razorpay lets a **vendor collect payments directly** on their own gateway (0%
platform commission). This follows the same pattern as **PayU/SHEPay**, but uses
the seller's Razorpay API keys instead of platform env vars.

> **Scope**
> - **Vendor setup** → `lib/payment/` (credential connect + `shop_commerce_settings` routing)
> - **Checkout** → `razorpay-direct-create` edge function + Payment Links
> - **Settlement** → `razorpay-direct-webhook` → `process_checkout_payment_webhook` RPC

---

## Architecture

```
Vendor connects Razorpay (Key ID + Secret)
    ↓
shop_payment_accounts + shop_commerce_settings (payment_mode = direct)
    ↓
Buyer checkout → atomic_marketplace_checkout (collection = direct, provider = razorpay)
    ↓
ensureDirectCheckoutUrl() → razorpay-direct-create
    ↓
Razorpay Payment Link (short_url) → buyer pays on rzp.io
    ↓
razorpay-direct-webhook → process_checkout_payment_webhook
    ↓
order_payments updated · inventory converted
```

Compare with **SHEPay (PayU)**: platform keys in env, `collection = shepay`,
`shepay-payu-create` / `shepay-payu-webhook`.

---

## Vendor setup

1. Open **Vendor settings → Payment Methods**
2. Select **Razorpay** (credential provider — visible without OAuth flag)
3. Optionally click **Run validation check** — calls `razorpay-validate` edge function
4. Enter:
   - **Key ID** (`rzp_test_…` / `rzp_live_…`)
   - **Key Secret** _(password field — never shown again after save)_
   - **Webhook Secret** (optional but recommended)
5. Click **Connect Razorpay** — calls `razorpay-connect` edge function:
   - Validates key prefix against selected mode (test/live)
   - Probes Razorpay API to confirm credentials are valid
   - **Encrypts** `key_secret` with AES-256-GCM before any DB write
   - Upserts `shop_payment_accounts` (encrypted `access_token`, `iv`+`auth_tag` in `metadata`)
   - Routing sync writes `shop_commerce_settings`:
     - `payment_connected = true`
     - `payment_mode = direct`
     - `payment_gateway = razorpay`

### Credential storage layout (new encrypted format)

| Column | Value |
|--------|-------|
| `merchant_id` | `keyId` (e.g. `rzp_live_xxxx`) |
| `access_token` | AES-256-GCM encrypted `key_secret` (hex) |
| `metadata.iv` | GCM IV (hex, 16 bytes) |
| `metadata.auth_tag` | GCM auth tag (hex, 16 bytes) |
| `metadata.mode` | `"test"` or `"live"` |
| `metadata.webhook_secret_encrypted` | Encrypted webhook secret (hex, optional) |
| `metadata.webhook_secret_iv` | IV for webhook secret (optional) |
| `metadata.webhook_secret_auth_tag` | Auth tag for webhook secret (optional) |

> The legacy format stored plain-text credentials as JSON in `metadata.credentials`.
> `parseStoredCredentials()` in `_shared/razorpay.ts` handles only legacy rows.
> The `isEncryptedAccount()` helper distinguishes the two formats.

### Disconnecting

Click **Disconnect** — calls `razorpay-disconnect` edge function:
- Sets `status = disconnected`, clears `access_token` and `metadata`
- Resets `shop_commerce_settings` to `payment_mode = shepay`

### Razorpay Dashboard

Register webhook URL (per shop or shared endpoint):

```
https://<project>.supabase.co/functions/v1/razorpay-direct-webhook
```

Subscribe to: `payment_link.paid`, `payment.captured`, `payment.failed`.

---

## Checkout flow (buyer)

After `atomic_marketplace_checkout`, `CheckoutScreen` calls:

```tsx
import { ensureDirectCheckoutUrl } from '~/commerce/lib/razorpay-direct'

const direct = await ensureDirectCheckoutUrl(result.data.paymentSteps)
// → external_pay with Payment Link short_url
```

Return URL after payment:

```
/orders/razorpay-return?status=success&step=<payment_step_id>
```

Webhook confirms payment asynchronously (same as PayU).

---

## File map

| File | Role |
|------|------|
| `lib/payment/payment.providers.config.ts` | Razorpay credential fields + catalog (`connectionType: credential`) |
| `lib/payment/payment.service.ts` | `validateRazorpayCredentials`, `connectRazorpay`, `disconnectRazorpay`, `createRazorpayOrder`, `verifyRazorpayPayment` |
| `lib/payment/payment.utils.ts` | `maskRazorpayKeyId`, `isRazorpayConnected`, `getRazorpayStatus`, `isLiveMode`, `formatSettlementSchedule`, `getRazorpayModeMismatchWarning` |
| `lib/payment/payment.store.ts` | `validateRazorpayCredentials`, `connectRazorpay`, `disconnectRazorpay` thunks |
| `commerce/lib/razorpay-direct.ts` | Client: `createRazorpayDirectSession`, `ensureDirectCheckoutUrl` |
| `commerce/lib/seller-commerce.ts` | Saves `payment_mode: direct` (not `gateway`) |
| `commerce/screens/CheckoutScreen.tsx` | Calls direct checkout after atomic create |
| `supabase/functions/_shared/razorpay.ts` | Auth header, Payment Links API, signature verify, `isEncryptedAccount` |
| `supabase/functions/_shared/encryption.ts` | AES-256-GCM `encryptSecret` / `decryptSecret` (Deno-only) |
| `supabase/functions/razorpay-validate/index.ts` | Validate credentials without saving (calls Razorpay API) |
| `supabase/functions/razorpay-connect/index.ts` | Encrypt + persist credentials, sync routing |
| `supabase/functions/razorpay-disconnect/index.ts` | Clear credentials, reset routing to shepay |
| `supabase/functions/razorpay-create-order/index.ts` | Decrypt + create Razorpay order at checkout |
| `supabase/functions/razorpay-verify-payment/index.ts` | HMAC-SHA256 signature verify after checkout |
| `supabase/functions/razorpay-direct-create/index.ts` | Creates Payment Link, sets `checkout_url` on step |
| `supabase/functions/razorpay-direct-webhook/index.ts` | Verifies signature → checkout webhook RPC |
| `app/(store)/orders/razorpay-return+spa.tsx` | Buyer return landing |

---

## Adding another direct provider (Stripe, Cashfree, …)

1. Add `PROVIDER_CREDENTIAL_FIELDS` + catalog entry (`connectionType: credential`)
2. Create `{provider}-direct-create` edge function (load shop credentials, call provider API)
3. Create `{provider}-direct-webhook` edge function
4. Extend `ensureDirectCheckoutUrl()` with a `provider` branch
5. Add return route if the provider uses callback URLs

PayU/SHEPay remains the reference for **platform-managed** collection; Razorpay
is the reference for **seller-direct** collection.

---

## References

- [Razorpay Payment Links API](https://razorpay.com/docs/payments/payment-links/)
- [Razorpay Webhooks](https://razorpay.com/docs/webhooks/)
- Internal: `doc/payment/vendor-gateway/README.md`, `doc/payment/README.md`
