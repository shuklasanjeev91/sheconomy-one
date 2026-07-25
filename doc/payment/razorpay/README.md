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
3. Enter:
   - **Key ID** (`rzp_test_…` / `rzp_live_…`)
   - **Key Secret**
   - **Webhook Secret** (optional but recommended)
4. Save — credentials go to `shop_payment_accounts.metadata.credentials`
5. Routing sync writes `shop_commerce_settings`:
   - `payment_connected = true`
   - `payment_mode = direct`
   - `payment_gateway = razorpay`

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
| `lib/payment/payment.service.ts` | `syncShopCommercePaymentRouting()` on credential save |
| `commerce/lib/razorpay-direct.ts` | Client: `createRazorpayDirectSession`, `ensureDirectCheckoutUrl` |
| `commerce/lib/seller-commerce.ts` | Saves `payment_mode: direct` (not `gateway`) |
| `commerce/screens/CheckoutScreen.tsx` | Calls direct checkout after atomic create |
| `supabase/functions/_shared/razorpay.ts` | Auth header, Payment Links API, signature verify |
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
