# Playwright smoke tests

Guest + multi-tier authenticated route/interaction smoke for web (desktop Chromium and iPhone 13 viewport).

## Run

```bash
yarn test:smoke
# or against an already-running dev server:
PLAYWRIGHT_SKIP_WEBSERVER=1 yarn test:smoke
```

## Guest (always runs)

- Desktop Chromium + Mobile Chrome (iPhone 13)
- Public / semi-public route load without 5xx or `pageerror`
- Center-tab and mobile bottom-tab interactions

## Authenticated tiers (optional)

Auth is OTP-based in the product, so Playwright cannot complete SMS login.
Inject a Supabase session instead by exporting access + refresh tokens for each
tier. Setup writes Playwright `storageState` files under `tests/smoke/.auth/`
(gitignored). **If tokens are missing, those projects skip with a clear message** —
guest coverage still runs.

| Tier | Env vars | Profile must satisfy |
|------|----------|----------------------|
| Limited | `SMOKE_LIMITED_ACCESS_TOKEN` `SMOKE_LIMITED_REFRESH_TOKEN` | Signed in; not both `gender=true` and `is_verified=true` |
| Verified female | `SMOKE_VERIFIED_ACCESS_TOKEN` `SMOKE_VERIFIED_REFRESH_TOKEN` | `gender=true`, `is_verified=true` |
| Vendor | `SMOKE_VENDOR_ACCESS_TOKEN` `SMOKE_VENDOR_REFRESH_TOKEN` | Verified female + role `V` + shop |
| Admin (optional) | `SMOKE_ADMIN_ACCESS_TOKEN` `SMOKE_ADMIN_REFRESH_TOKEN` | Role `A` |

Obtain tokens from a real browser session after OTP sign-in:

1. Sign in as the test user on the web app.
2. DevTools → Application → Local Storage → `sb-zsaqrrzwygzwrlzgymxk-auth-token`.
3. Copy `access_token` and `refresh_token` into your shell / `.env.local` (never commit).

Optional: `SMOKE_SUPABASE_URL` / `SMOKE_SUPABASE_ANON_KEY` override the public defaults
from `config/supabase-public.ts`.

## What auth projects assert

- **Limited** on `/community`, `/chat`, `/create-my-shop` → verification UI or safe redirect; body not blank.
- **Verified** on gender-gated + settings/profile → real surface; URL must **not** contain `gender=restricted`.
- **Verified** account menu → Settings / Profile land on real routes (guards the account-menu regression).
- **Vendor** on `/vendor/*` → console chrome, not Access denied / restricted.
