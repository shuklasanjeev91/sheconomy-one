# Auth: Social, Passkeys, Sessions & Platform UX

Enablement checklist for SHEconomy passwordless + social auth on project **sheconomy_db**.

App code ships for OTP, Google One Tap, OAuth, passkeys, sessions, biometrics, Android phone hint / SMS autofill, and QR login. Production still needs Dashboard / Apple / Google / LinkedIn / EAS credentials below.

## Redirect URLs

Add each environment’s callback in **Supabase → Authentication → URL Configuration**:

| Environment | URL |
| --- | --- |
| Local web | `http://localhost:8081/**` (One dev server; add `:3000` if you use it) |
| Production web | `https://sheconomy.in/**` and `https://www.sheconomy.in/**` |
| Native deep link | `sheconomy://auth/callback` (native OAuth always uses this) |
| QR approve | `https://<your-web-host>/auth/qr` and `sheconomy://auth/qr` |

Web OAuth redirects to `<current origin>/auth/callback?returnTo=…`, so the web
entries need a `/**` glob. A redirect that is not allowlisted silently falls
back to the Site URL (`https://www.sheconomy.in/`); `completeStrayOAuthRedirect`
finishes those sign-ins in place, but native cannot recover from it — the
auth browser never returns to the app.

Also set `EXPO_PUBLIC_WEB_APP_URL` for release builds so QR URLs use the production host.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Auth backend |
| `EXPO_PUBLIC_WEB_APP_URL` | OAuth + QR base URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google One Tap (web) + native Google `webClientId` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Native Google on iOS (optional) |
| `EXPO_PUBLIC_ANDROID_SMS_HASH` | App hash fragment for SMS Retriever templates |
| `EXPO_PUBLIC_ENABLE_PASSKEY_LOGIN` | Set to `true` only after Supabase Passkeys are enabled |

## Social providers

### Google

1. Google Cloud Console → OAuth clients (Web + iOS/Android).
2. Supabase → Providers → **Google** → enable; Client ID + secret.
3. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the **Web** client ID (required for One Tap + native ID token exchange).
4. Android: SHA-1 fingerprints for Play / EAS keystore on the Google OAuth client.
5. iOS native Google: add `@react-native-google-signin/google-signin` Expo plugin with `iosUrlScheme` = reversed iOS client ID (`com.googleusercontent.apps.<id>`).
6. **One Tap / FedCM**: authorized JavaScript origins must include your web origin (e.g. `https://app…`).

### Apple

1. Apple Developer → **Services ID** + Sign in with Apple key.
2. Supabase → Providers → **Apple** → enable.
3. App uses `expo-apple-authentication` + `usesAppleSignIn: true` in `app.json`.
4. Face ID usage string is set for biometric unlock (`NSFaceIDUsageDescription`).

### LinkedIn

1. LinkedIn Developer → OIDC app (`openid`, `profile`, `email`).
2. Supabase → **LinkedIn (OIDC)** → enable.
3. Redirect URL = Supabase Auth callback (`https://<project-ref>.supabase.co/auth/v1/callback`).

## Passkeys

1. Supabase Dashboard → Authentication → **Passkeys** → enable.
2. Client: `auth.experimental.passkey: true` in `lib/supabase/client.ts`.
3. Set `EXPO_PUBLIC_ENABLE_PASSKEY_LOGIN=true` for the deployment.
4. Sign-in CTA when platform supports WebAuthn; manage under **Settings → Security**.

## Android phone + SMS

- **Phone Number Hint**: Play Services via `react-native-otp-verify` `requestHint` on phone tab.
- **SMS Retriever / User Consent**: `lib/platform/otp-autofill.native.ts` listens with `getOtp` / `addListener` (no `READ_SMS`).
- Include the app hash from `getHash()` (or `EXPO_PUBLIC_ANDROID_SMS_HASH`) in the Supabase SMS template body so Retriever can match.

## Biometric unlock (app re-entry)

- Settings → Privacy → enable Face ID / Fingerprint / device passcode unlock.
- Cold start with a remembered session shows `BiometricUnlockGate` until authentication succeeds.
- Does **not** replace OTP/social/passkey sign-in; it gates an existing persisted session.

## QR login (web ↔ phone)

1. Web sign-in → **Log in with phone (QR code)** creates `auth_qr_login_challenges` row.
2. Phone (already signed in) opens `/auth/qr?c=…` (scan) or pastes code under **Settings → Security**.
3. After approve, web polls then calls Edge Function `qr-login-redeem` (deployed, `verify_jwt: false`, uses service role + `generateLink` / `verifyOtp`).
4. Challenges expire in ~2 minutes.

Migration: `supabase/migrations/20260715140000_auth_qr_login_challenges.sql`.

## Sessions & suspicious login

- Table `auth_login_sessions` + RPCs + template `security_login_alert`.
- Heuristic: new device or IP /16 change while other sessions active.
- Remediation: **Security → Sign out all other devices**.

## Smoke / verification matrix

| Feature | Web | iOS | Android |
| --- | --- | --- | --- |
| Google One Tap | ✓ (client ID) | — | — |
| Google OAuth / button | ✓ | native preferred | account selector preferred |
| Apple | ✓ | native | N/A |
| Email / phone autofill | ✓ | ✓ | ✓ |
| WebOTP / paste OTP | ✓ | paste | paste + SMS listener |
| Phone Number Hint | — | — | ✓ |
| Passkey | ✓ | where supported | where supported |
| Remembered session | ✓ | ✓ | ✓ |
| Biometric unlock | — | Face ID / Touch ID / PIN | Fingerprint / PIN |
| QR login | show + redeem | approve | approve |
| Sessions / logout all | ✓ | ✓ | ✓ |

## EAS / secrets

Never commit provider secrets. Store Google/Apple/LinkedIn secrets in Supabase Dashboard; put public client IDs and `EXPO_PUBLIC_WEB_APP_URL` in EAS env.
