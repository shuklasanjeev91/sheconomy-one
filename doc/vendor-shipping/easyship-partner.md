# EasyShip partner / marketplace account

SHEconomy runs EasyShip as a **marketplace MOR** account (labels buy on the platform company; sellers fund labels via in-app `platform_wallets`).

## Live account (already wired)

| Field | Value |
|---|---|
| Company | Ampersand Media Makers |
| EasyShip company id | `CIN1056135` |
| Contact | sanjeev.shukla@sheconomy.in |
| Public API | `EASYSHIP_API_TOKEN` + `EASYSHIP_BASE_URL` (Supabase Edge secrets) |
| Webhook | `EASYSHIP_WEBHOOK_SECRET` → `easyship-webhook` |

Optional Edge secret (set for partner/enterprise routing):

```bash
npx supabase secrets set EASYSHIP_COMPANY_ID=CIN1056135 --yes
```

`resolveEasyshipConfig()` reads `EASYSHIP_COMPANY_ID` and sends `X-EASYSHIP-COMPANY-ID` on Public API calls when present.

## Partner application

Submitted via [Become a Partner](https://www.easyship.com/become-a-partner) as:

- Business class: **Enterprise or Marketplace Platform**
- Intent: **Partner or integrate with Easyship**
- Callback (for future OAuth): `https://www.sheconomy.in/oauth/easyship`

EasyShip will reply with partner app `client_id` / `client_secret` and scopes. Until then we keep the existing Public API token.

## After partner credentials arrive

1. Store secrets (never commit):
   - `EASYSHIP_PARTNER_CLIENT_ID`
   - `EASYSHIP_PARTNER_CLIENT_SECRET`
2. Build OAuth connect (Authorization Code) per [connect users](https://developers.easyship.com/docs/how-to-authorize-easyship-user).
3. For Enterprise child companies: Client Credentials + `enterprise.child_company::access`, create company per shop (`external_id = shop_id`), pass shop company id in `X-EASYSHIP-COMPANY-ID`.

## Ops checklist for fulfill to work

1. **Top up EasyShip dashboard credit** for company `CIN1056135` (API currently shows ₹0 — label buy will 402).
2. Link India courier own accounts (FedEx/UPS) on the EasyShip org when quoting IN origin.
3. Sellers still top up **Vendor → Wallet** (shop `platform_wallets`); fulfill debits that wallet after EasyShip charges the MOR account.
