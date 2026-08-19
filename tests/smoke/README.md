# Playwright smoke tests

Guest + multi-tier authenticated route/interaction smoke for web (desktop Chromium and iPhone 13 viewport).

## Run

```bash
yarn test:smoke
# or against an already-running dev server:
PLAYWRIGHT_SKIP_WEBSERVER=1 yarn test:smoke
```

## Guest (always runs)

- Desktop Chromium + Mobile Chrome (iPhone 13 viewport on Chromium)
- Public / semi-public route load without 5xx or `pageerror`
- Center-tab and mobile bottom-tab interactions
- Live high-risk guest checklist

## Authenticated tiers (A and/or C)

Auth is OTP-based in the product, so Playwright cannot complete SMS login.
Sessions are injected via storageState under `tests/smoke/.auth/` (gitignored).

### Path A — paste tokens

After OTP sign-in in a real browser:

1. DevTools → Application → Local Storage → `sb-zsaqrrzwygzwrlzgymxk-auth-token`
2. Copy `access_token` and `refresh_token` into `.env.local` (never commit):

| Tier | Env vars | Profile must satisfy |
|------|----------|----------------------|
| Limited | `SMOKE_LIMITED_ACCESS_TOKEN` `SMOKE_LIMITED_REFRESH_TOKEN` | Not both `gender=true` and `is_verified=true` |
| Verified female | `SMOKE_VERIFIED_ACCESS_TOKEN` `SMOKE_VERIFIED_REFRESH_TOKEN` | `gender=true`, `is_verified=true` |
| Vendor | `SMOKE_VENDOR_ACCESS_TOKEN` `SMOKE_VENDOR_REFRESH_TOKEN` | Verified female + role `V` |
| Admin | `SMOKE_ADMIN_ACCESS_TOKEN` `SMOKE_ADMIN_REFRESH_TOKEN` | Role `A` |

### Path C — mint with service role

```bash
# Dashboard → Project Settings → API → service_role (secret)
# Put in .env.local as SUPABASE_SERVICE_ROLE_KEY=...  (never commit)

yarn smoke:mint
yarn test:smoke
```

`yarn smoke:mint` prefers path A tokens when present; for any missing tier it looks up a matching `profiles` row (or `SMOKE_<TIER>_USER_ID`) and creates a magic-link session via the Admin API, writing `tests/smoke/.auth/<tier>.json`.

Optional: `source tests/smoke/.auth/env.exports` to export minted tokens into the current shell.

### What auth projects assert

- **Limited** on gender-gated routes → verification UI or safe gate; body not blank.
- **Verified** → real surface; URL must **not** contain `gender=restricted`.
- **Verified** account menu → Settings / Profile land on real routes.
- **Vendor** on `/vendor/*` → console chrome, not Access denied / restricted.
- **Admin** on `/admin` → console chrome.
