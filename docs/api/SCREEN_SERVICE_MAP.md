# SHEconomy REST / Screen → Service Map

This catalog maps primary app surfaces to the domain modules and backend entry points they use.
The Expo client talks to **Supabase** (PostgREST `.from()` / `.rpc()`, Auth, Storage, Realtime) plus Edge Functions for secrets/webhooks.

A thin JWT **REST gateway** lives at `supabase/functions/rest-gateway` for partners/admin tools. It does **not** replace the client-side Supabase BFF.

## Envelope

All gateway responses use:

```json
{ "ok": true, "data": {}, "error": null }
```

or

```json
{ "ok": false, "data": null, "error": "message" }
```

Auth: `Authorization: Bearer <supabase_access_token>`.

OpenAPI: `GET /functions/v1/rest-gateway/openapi.json`

---

## Navigation / sections

| Section | Routes (prefix) | Domain modules |
|---------|-----------------|----------------|
| Commerce | `/`, `/shops`, `/listing`, `/cart`, `/checkout`, `/orders` | `commerce/lib/*`, `lib/listing`, `lib/shop`, `lib/orders` |
| Vendor | `/vendor/*`, `/create-my-shop` | `commerce/screens/vendor/*`, `lib/shop`, `lib/orders` |
| Community | `/community/*` | `community/lib/*` |
| Chat | `/chat/*` | `chat/lib/*`, LiveKit edge |
| Class | `/class/*` | `class/lib/*` |
| Co-Work | `/co-work/*` | `co-work/lib/*`, LiveKit edge |
| Auth | `/auth/*` | `features/auth`, `lib/supabase/auth`, `lib/gender-verification` |
| Profile / Settings | `/profile`, `/settings`, `/notifications` | `lib/profile`, settings screens |
| Admin | `/admin/*` | Admin pages + `lib/cms`, direct Supabase admin queries |
| Help / Legal | `/help`, `/legal/*` | `lib/help`, static legal screens |

---

## Priority REST resources (gateway)

| Method | Path | Backing |
|--------|------|---------|
| GET | `/v1/me` | `profiles` |
| GET | `/v1/listings` | `listings` |
| GET | `/v1/listings/{slug}` | `listings` |
| GET | `/v1/shops/{slug}` | `shops` |
| GET | `/v1/cart` | `carts` + `cart_items` |
| GET | `/v1/orders` | `orders` (buyer) |
| GET | `/v1/posts` | `posts_with_stats` / `posts` |
| GET | `/v1/notifications` | `notifications` |
| GET | `/v1/meetings` | `meetings` |
| GET | `/health` | liveness |
| GET | `/openapi.json` | this OpenAPI document |

---

## Screen → service (high traffic)

### Auth
- Sign-in OTP → `features/auth/services/auth-otp.ts` → `supabase.auth.signInWithOtp` / `verifyOtp`
- Gender verification → `lib/gender-verification` → RPCs `create_gender_verification_session`, `complete_gender_verification_session`
- QR login → RPCs + edge `qr-login-redeem`

### Commerce
- Home / browse / search → `commerce/lib/commerce.ts`, `lib/search/*`
- Listing detail → `commerce/lib/*`, listing RPCs
- Cart / checkout → cart/checkout RPCs; PayU → `shepay-payu-create` / webhooks
- Orders / delivery → `lib/orders/*`; shipping → `shedelivery-create-shipment`

### Community
- Feed / posts → `community/lib/community.ts`
- Network → `community/lib/network*` + edge `network-invite`
- Jobs / companies / groups / events / stories → matching `community/lib/*` modules

### Chat
- Inbox / thread → `chat/lib/chats.ts` (RPCs `get_user_chats`, `send_message_with_status`, …)
- Calls → LiveKit `livekit-token` / `livekit-config`

### Class
- Catalog / player → `class/lib/*` + `programs` tables

### Co-Work
- Meetings → `co-work/lib/*` + `meetings` tables
- Live / recording → `livekit-token`, `livekit-recording`, `meeting-recording-share`

### Admin
- Users / shops / products / orders → direct Supabase in `app/admin/*`
- CMS / blog → `lib/cms/*`
- Moderation → `content_reports`
- Sale events → `sale_events`

### Existing edge functions (not replaced)
`ai-assist`, `cleanup-expired-stories`, `commerce-payment-webhook`, `dispatch-notifications`, `exchange-rates`, `link-preview`, `livekit-*`, `meeting-invite`, `meeting-recording-share`, `network-invite`, `places`, `qr-login-redeem`, `shedelivery-*`, `shepay-*`, **`rest-gateway`**

---

## Deploy

```bash
supabase functions deploy rest-gateway
```

`verify_jwt = true` in `supabase/config.toml`.
