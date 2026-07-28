# Razorpay BYOK — End-to-End Integration

SHEconomy uses a **Bring Your Own Key (BYOK)** model for Razorpay.  
Every vendor connects their own Razorpay account. When a buyer pays, the money goes **directly** into the vendor's Razorpay account — SHEconomy never touches the funds.

---

## Architecture Overview

```
Vendor Dashboard                  Supabase Edge Functions         Razorpay
─────────────────                 ────────────────────────         ────────
Connect Razorpay ──────────────▶  razorpay-connect
  (Key ID + Key Secret)            ├─ validate against Razorpay API
                                   ├─ AES-256-GCM encrypt key_secret
                                   ├─ store in shop_payment_accounts
                                   └─ update shop_commerce_settings
                                       payment_mode = 'direct'
                                       payment_gateway = 'razorpay'

Buyer Checkout                    Supabase DB (PL/pgSQL)
──────────────                    ─────────────────────
Place order ───────────────────▶  atomic_marketplace_checkout()
                                   └─ reads shop_commerce_settings
                                   └─ creates payment step:
                                       collection = 'direct'
                                       provider   = 'razorpay'

Post-order (client) ───────────▶  razorpay-direct-create
                                   ├─ decrypt key_secret (AES-256-GCM)
                                   ├─ create Razorpay Payment Link
                                   └─ store checkout_url on step

Redirect to rzp.io ────────────▶  Buyer completes payment (Razorpay)
                                       │
                                       ▼ callbackUrl
                                  /orders/razorpay-return   (in-app page)
                                       │
                                       ▼
                                  Order success screen

Razorpay webhook ──────────────▶  razorpay-direct-webhook
                                   ├─ verify HMAC-SHA256 signature
                                   └─ update order status → paid
```

---

## Required Supabase Secrets

Set these in the Supabase Dashboard → Settings → Vault, or via CLI:

| Secret | Description | Example |
|---|---|---|
| `PAYMENT_ENCRYPTION_KEY` | 32-byte AES key (64 hex chars). **Must match local `.env`.** | `openssl rand -hex 32` |
| `PUBLIC_APP_URL` | Canonical web origin. Used as the Razorpay callbackUrl base. | `https://sheconomy-one-sanjeev-shuklas-projects.vercel.app` |

**Critical:** Without `PAYMENT_ENCRYPTION_KEY`, credential decryption fails and checkout is blocked.  
**Important:** Without `PUBLIC_APP_URL`, the Razorpay return URL defaults to `https://sheconomy.com` which will not route the buyer back correctly.

### Set via CLI

```bash
supabase secrets set \
  PAYMENT_ENCRYPTION_KEY=<64-hex-chars> \
  PUBLIC_APP_URL=https://sheconomy-one-sanjeev-shuklas-projects.vercel.app \
  --project-ref zsaqrrzwygzwrlzgymxk
```

### Set via Dashboard

[https://supabase.com/dashboard/project/zsaqrrzwygzwrlzgymxk/settings/vault](https://supabase.com/dashboard/project/zsaqrrzwygzwrlzgymxk/settings/vault)

---

## Deployed Edge Functions

| Function | Purpose |
|---|---|
| `razorpay-validate` | Validate credentials against Razorpay API (no DB write) |
| `razorpay-connect` | Encrypt + store credentials; update routing settings |
| `razorpay-disconnect` | Clear credentials; reset routing to SHEPay |
| `razorpay-create-order` | Create Razorpay Order (for SDK checkout flow) |
| `razorpay-verify-payment` | HMAC-SHA256 signature verification |
| `razorpay-direct-create` | Create Razorpay Payment Link for checkout step |
| `razorpay-direct-webhook` | Handle Razorpay webhook events → update order status |

---

## Vendor Setup Flow

1. Go to **Vendor Settings → Payment**
2. Select **Connect Razorpay**
3. Choose **Test Mode** or **Live Mode**
4. Enter **Key ID** (e.g. `rzp_test_xxxx`) and **Key Secret**
5. Optionally enter **Webhook Secret** (from Razorpay Dashboard → Webhooks)
6. Optionally enter **Webhook URL**: `https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/razorpay-direct-webhook`
7. Click **Run validation check** — makes a real Razorpay API call to verify credentials
8. Click **Connect Razorpay**

After connecting, `shop_commerce_settings` is updated:
```
payment_mode      = 'direct'
payment_gateway   = 'razorpay'
payment_connected = true
```

---

## Buyer Checkout Flow

### 1. Payment method selection

When a buyer checks out a shop that has Razorpay connected, the payment option shows:

```
○ Pay [ShopName]
  Via Razorpay · paid directly to the seller · 0% commission
```

### 2. Place order

Buyer selects **Pay online** and clicks **Place your order**.

The DB function `atomic_marketplace_checkout` reads `shop_commerce_settings` and creates a payment step:
```json
{
  "collection": "direct",
  "provider":   "razorpay",
  "status":     "pending",
  "amount":     1999.00
}
```

### 3. Razorpay Payment Link creation

The client calls `razorpay-direct-create` with the `payment_step_id`.  
The function:
- Decrypts the vendor's `key_secret` using `PAYMENT_ENCRYPTION_KEY`
- Calls `POST https://api.razorpay.com/v1/payment_links` using the **vendor's** credentials
- Returns `{ checkout_url, payment_link_id, key_id }`

The `checkout_url` is an `rzp.io/...` short URL.

### 4. Payment redirect

**Web:** The buyer is redirected to `rzp.io/...` in the **same browser tab**. After payment, Razorpay redirects back to `/orders/razorpay-return?status=success&step=<id>`.

**Mobile:** The link opens externally via `Linking.openURL()`. The buyer returns manually.

### 5. Return page

`/orders/razorpay-return`:
- Reads `pendingOrderSuccess` from local storage (saved before redirect)
- On success: navigates to order success screen
- On failure: cancels the checkout hold and returns to cart

### 6. Webhook (order status)

Razorpay fires a POST to the webhook URL after payment:

```
POST https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/razorpay-direct-webhook
```

`razorpay-direct-webhook`:
1. Parses the event body
2. Decrypts the webhook secret (or key_secret as fallback)
3. Verifies HMAC-SHA256 signature against `x-razorpay-signature` header
4. Calls `process_checkout_payment_webhook` DB RPC → updates `order_status = 'paid'`

---

## Webhook Setup in Razorpay Dashboard

1. Open [https://dashboard.razorpay.com/app/webhooks](https://dashboard.razorpay.com/app/webhooks)
2. Click **Add New Webhook**
3. URL: `https://zsaqrrzwygzwrlzgymxk.supabase.co/functions/v1/razorpay-direct-webhook`
4. Secret: any random 32+ char string (save this — enter it as **Webhook Secret** in the app)
5. Enable events: `payment.captured`, `payment.failed`, `order.paid`
6. Save

---

## Local Development / Testing

For local testing with ngrok:

```bash
# Start ngrok tunnel
ngrok http 8081

# Set the tunnel URL in Supabase
supabase secrets set \
  PUBLIC_APP_URL=https://<your-ngrok-subdomain>.ngrok-free.app \
  --project-ref zsaqrrzwygzwrlzgymxk

# Re-deploy razorpay-direct-create so it picks up the new URL
supabase functions deploy razorpay-direct-create \
  --project-ref zsaqrrzwygzwrlzgymxk --no-verify-jwt
```

---

## Security Model

| What | How |
|---|---|
| `key_secret` storage | AES-256-GCM encrypted, IV + authTag stored in metadata |
| `webhook_secret` storage | AES-256-GCM encrypted separately in metadata |
| Client exposure | `key_id` only (masked); secrets **never** returned |
| Shop ownership | Every vendor function verifies `shops.user_id = auth.uid()` |
| Webhook signature | HMAC-SHA256 + timing-safe comparison via `timingSafeEqual` |
| Encryption key | Lives only in `PAYMENT_ENCRYPTION_KEY` Supabase secret |

---

## Testing Checklist

- [ ] `PAYMENT_ENCRYPTION_KEY` set in Supabase Vault
- [ ] `PUBLIC_APP_URL` set in Supabase Vault
- [ ] Razorpay webhook registered in Razorpay Dashboard
- [ ] Vendor connects Razorpay (Test mode, `rzp_test_` credentials)
- [ ] Buyer adds item from that vendor's shop to cart
- [ ] Buyer selects "Pay online" at checkout
- [ ] Buyer places order → redirected to Razorpay Payment Link
- [ ] Buyer completes test payment (UPI/card on rzp.io)
- [ ] Buyer redirected back to `/orders/razorpay-return` → order success
- [ ] Order status updated to `paid` via webhook
- [ ] Check `shop_payment_accounts` row: `status = 'connected'`, `access_token` contains ciphertext
