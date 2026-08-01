# Device release-APK QA — 2026-07-31

Device: SM_G781B (`RZCT80X8MVA`) / `com.sheconomy.ecommerce`  
Build: local `assembleRelease` (arm64-v8a), **no Metro** — embedded `assets/index.android.bundle`  
APK: `dist/app-release.apk` (81 MB)

## Launch / branding

| Check | Result |
|-------|--------|
| Install without Metro | PASS |
| Cold start (after clean uninstall) | PASS — onboarding + sign-in render |
| Blank black/white screen | FIXED — was RNCallKeep New Arch overload crash |
| Onboarding logo full (not cropped in UI) | PASS |
| Process stays alive across deep links | PASS |

### Blank-screen root cause
`RNCallKeep` exported two `@ReactMethod` overloads named `displayIncomingCall` / `startCall`. New Architecture TurboModules reject that → `Error loading route ./_layout.native.tsx` → blank screen.  
Patched via `scripts/patch-callkeep-newarch-overloads.cjs` (also in `postinstall`).

## Critical-flows matrix (guest / auth walls)

Automated OTP sign-in was **not** completed this run (session was guest). Commerce home/cart/orders correctly hit auth walls.

**Totals:** PASS=31 WARN=18 FAIL=9

- FAIL (7): auth_wall on `/`, `/shops`, `/favorites`, `/cart`, `/browse/categories`, `/orders`, `/addresses`, `/checkout` — expected without sign-in
- FAIL (1): `form/search` — no search field (likely still on auth/gated UI)
- WARN: sparse_ui on several community/class/settings routes (guest / gated)
- PASS: search, chat, co-work, settings (most), help, legal, vendor shells, several forms

## Notes

1. Prefer **clean uninstall** before installing a new local release APK (stale odex left a black screen once after `-r` upgrade).
2. Adaptive icon safe-zone asset is in `public/app-icon-adaptive.png` (needs EAS/native rebuild for Play icon).
3. For signed-in full coverage, run `scripts/device-qa/sign_in_email.py` then re-run `run_critical_flows.py`.
