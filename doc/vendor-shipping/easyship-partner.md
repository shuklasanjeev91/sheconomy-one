# EasyShip partner model (like PayU child MIDs)

Goal: **SHEconomy does not float EasyShip credit.** Sellers fund carrier labels the same way they fund PayU — through SHEconomy UI, settling on *their* EasyShip account.

## Compare to PayU

| | PayU today | EasyShip target |
|---|---|---|
| Platform | Parent MID / Hub | Partner org + parent company `CIN1056135` |
| Per seller | Child MID (`shepay-create-child`) | **Child company** (`shops.easyship_company_id`) |
| Seller funds | Settlements / KYC on child | Card on child → `POST /account/credit` |
| Platform float | No | **No** (once child is linked) |
| API routing | Child credentials / mid | `X-EASYSHIP-COMPANY-ID` on Public API |

## Recommended flow (seller-funded)

```
Vendor enables shipping
  → easyship-shop-account action=ensure
  → Enterprise Create Company (external_id = shop_id)
  → store shops.easyship_company_id

Vendor adds card (Stripe token → EasyShip payment source on child)
  → store shops.easyship_payment_source_id

Vendor → Wallet → Top up shipping
  → easyship-shop-account action=topup
  → POST /account/credit { payment_source_id, amount } + X-EASYSHIP-COMPANY-ID
  → EasyShip charges seller card; child credit rises
  → optional mirror into platform_wallets for UI

Fulfill order
  → rates + createShipment with shop company header
  → charge EasyShip child credit
  → debit mirrored platform_wallets (ledger)
```

**Do not** keep using a shared MOR balance long-term — that forces SHEconomy to pre-fund EasyShip (current pain).

## Alternatives (worse / different)

1. **OAuth “Connect EasyShip”** — seller brings their own EasyShip login. Zero float, more friction for new sellers.
2. **PayU top-up only into `platform_wallets`** (today) — money never reaches EasyShip; platform still must fund MOR. Keep only as interim ledger UX.
3. **Platform auto-recharges MOR from its card when low** — still platform float / risk.

## Live status

| Item | Status |
|---|---|
| Public API token | Live (`EASYSHIP_API_TOKEN`) |
| Parent company | `CIN1056135` Ampersand Media Makers |
| `EASYSHIP_COMPANY_ID` secret | Set |
| Partner application | Submitted (Become a Partner) |
| Partner OAuth client id/secret | **Waiting on EasyShip** |
| `shops.easyship_*` columns | Migration `20261116081723_shops_easyship_partner_account` |
| Edge `easyship-shop-account` | status / ensure (pending) / topup |

## Secrets (after EasyShip replies)

```bash
npx supabase secrets set \
  EASYSHIP_PARTNER_CLIENT_ID=... \
  EASYSHIP_PARTNER_CLIENT_SECRET=... \
  EASYSHIP_ORGANIZATION_ID=... \
  --yes
```

Then finish `ensure` (Create Company) + Vendor Wallet card collect + top-up UI.

## Ops until partner is live

Parent EasyShip credit is still ₹0 — fulfill on unlinked shops needs MOR top-up **or** wait for child companies. Seller in-app wallet credit alone does not buy labels.
