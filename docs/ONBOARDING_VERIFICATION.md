# Secure onboarding & verification

Cross-platform (Web / Android / iOS) passwordless onboarding on top of the existing Supabase OTP auth.

## Architecture

| Layer | Role |
| --- | --- |
| `components/auth/*` | Existing shell + enhanced OTP UI |
| `features/auth/*` | Validation, OTP autofill hook, OAuth helpers |
| `features/contacts/*` | Optional contact import after first signup |
| `lib/platform/otp-autofill.*` | WebOTP / native autofill adapters |
| `lib/platform/contact-picker.*` | Contact Picker API / expo-contacts adapters |
| Supabase Auth | Server-side OTP send + verify (no client secrets) |

OTP values are never logged. Contact import uploads **only selected fields**.

## Packages

- `expo-contacts`
- `expo-secure-store` (available for sensitive device secrets)
- `expo-web-browser` (OAuth sessions)

## Platform configuration

### Android

- No `READ_SMS`, `RECEIVE_SMS`, or `READ_CALL_LOG`
- OTP uses Play Services autofill (`autoComplete="sms-otp"`)
- Optional `EXPO_PUBLIC_ANDROID_SMS_HASH` for SMS Retriever-format templates
- Contacts via system picker / `expo-contacts` only after user tap

### iOS

- `NSContactsUsageDescription` in `app.json`
- OTP: `textContentType="oneTimeCode"`
- Sign in with Apple available when supported

### Web

- `autocomplete="email" | "tel" | "one-time-code" | "name"`
- WebOTP when `OTPCredential` exists
- Contact Picker API when `navigator.contacts` exists; otherwise skip copy

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Auth backend |
| `EXPO_PUBLIC_WEB_APP_URL` | OAuth redirect base |
| `EXPO_PUBLIC_ANDROID_SMS_HASH` | Optional SMS template hash |

## Backend requirements

OTP continues via Supabase Auth (`signInWithOtp` / `verifyOtp`) — verification is server-side.

Contact import table (migration `20260714290000_user_imported_contacts.sql`):

- `user_imported_contacts` with `consent`, `consented_at`, phone/email arrays
- RLS: owner-only

Conceptual API mapping used by the client services:

- `POST /api/auth/send-otp` → `sendAuthOtp` → Supabase
- `POST /api/auth/verify-otp` → `verifyAuthOtp` → Supabase
- `POST /api/contacts/import` → `importSelectedContacts` → Supabase insert

Configure Google / Apple providers in the Supabase dashboard for social buttons.

## Privacy notes

- No silent SMS/email/contact reads
- Contact permission only after **Select contacts**
- Import requires explicit consent timestamp
- Skip is always available; registration is not blocked
- Do not log OTP, tokens, or contact payloads in analytics

## Manual test plan

1. Web email OTP — autofill / paste 6 digits — auto verifies
2. Web phone OTP — manual entry when WebOTP unsupported
3. Android — SMS suggestion fills OTP field without SMS permission
4. iOS — keyboard OTP suggestion
5. Deny contacts permission → Open Settings / Skip
6. Select contacts → deselect phone/email → import only remaining
7. Skip contact import → lands in app
8. Google / Apple (when providers configured)

## Known limitations

- Full Android SMS Retriever native listener is not bundled; OS autofill + hash env are used
- Some Android versions fall back to an in-app select list after permission (still uploads only selected rows)
- Contact Picker API is Chromium/HTTPS-only on web
- Supabase session storage remains AsyncStorage on native (JWT size); rotate keys via Supabase Auth
