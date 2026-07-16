# Secure onboarding & verification

Cross-platform (Web / Android / iOS) passwordless onboarding on top of the existing Supabase OTP auth.

## Architecture

| Layer | Role |
| --- | --- |
| `components/auth/*` | Shell + OTP UI + smart complete-profile wizard |
| `components/media/AvatarCaptureField.tsx` | Library / camera avatar upload in onboarding |
| `components/forms/NativeDateField.tsx` | DOB picker (native DateTimePicker / web date input) |
| `features/auth/*` | Validation, OTP autofill, OAuth, enrichment, location, contact suggest, sensitive-action gates |
| `features/contacts/*` | Optional network contact import after onboarding |
| `lib/platform/otp-autofill.*` | WebOTP / native autofill adapters |
| `lib/platform/contact-picker.*` | Contact Picker API / expo-contacts adapters |
| Supabase Auth | Server-side OTP send + verify (no client secrets) |

## Profile enrichment & complete-profile funnel

After sign-in, `enrichProfileFromAuth` sparse-fills name / email / avatar / country / timezone / language from Auth metadata (Google / Apple / LinkedIn identities) + device locale.

New or incomplete profiles (`onboarding_completed_at` null and completion &lt; 40% or missing name/avatar/interests) go to `/auth/complete-profile`.

`resolveOnboardingSteps` skips steps that are already complete (verified phone, prefs, interests) while always offering basics for review.

1. Basics — social-imported name/photo, choose/take photo, optional contact-card suggest
2. Mobile verification (`updateUser` + phone OTP) — skippable / skipped when verified
3. Prefs — country, city/region, timezone, language (device language + location buttons), optional DOB
4. Interest chips (skipped if already set)
5. Member intents — then optional network contact import CTA

Selling intent can open shop setup (`/create-my-shop`). Soft nudge (`ProfileOnboardingNudge`) reappears if onboarding stays unfinished.

Migration: `supabase/migrations/20260715150000_enrich_profile_onboarding.sql` (`timezone`, `country_code`, `member_intents`, `onboarding_completed_at` + enriched upsert / completion weights).

OTP values are never logged. Contact import / contact suggest uploads **only selected fields**.

## Packages

- `expo-contacts`
- `expo-location`
- `expo-image-picker` / `expo-document-picker`
- `expo-localization`
- `expo-local-authentication`
- `@react-native-community/datetimepicker`
- `expo-secure-store` (available for sensitive device secrets)
- `expo-web-browser` (OAuth sessions)

## Platform checklist

| Feature | Web | Android | iOS |
| --- | --- | --- | --- |
| Browser / device language detection | `navigator.language` | `expo-localization` | `expo-localization` |
| Location request (prefs) | Geolocation API | `expo-location` permission | `expo-location` permission |
| Social profile import (name/photo) | OAuth metadata | Google native + OAuth | Apple / Google identities |
| Contact me-card suggest | Contact Picker API when available | System contact picker | System contact picker |
| Network contact import CTA | After finish when supported | After finish | After finish |
| Avatar library pick | File input | ImagePicker library | Photo library |
| Avatar camera capture | — | ImagePicker camera | Camera |
| Native date of birth | `<input type="date">` | DateTimePicker | DateTimePicker |
| Keyboard-friendly forms | `autocomplete` / `enterKeyHint` | `autoComplete` / `returnKeyType` | `textContentType` / `returnKeyType` |
| Face ID / biometrics on sensitive changes | N/A (dialog only) | Fingerprint / face when enrolled | Face ID / Touch ID when enrolled |

Sensitive actions gated by `confirmSensitiveAction`: unlink social, delete passkey, sign out of all devices.

## Platform configuration

### Android

- No `READ_SMS`, `RECEIVE_SMS`, or `READ_CALL_LOG`
- OTP uses Play Services autofill (`autoComplete="sms-otp"`)
- Optional `EXPO_PUBLIC_ANDROID_SMS_HASH` for SMS Retriever-format templates
- Contacts via system picker / `expo-contacts` only after user tap
- Location / camera / photo library permissions via Expo modules

### iOS

- `NSContactsUsageDescription` in `app.json`
- OTP: `textContentType="oneTimeCode"`
- Sign in with Apple available when supported
- Face ID prompts use `expo-local-authentication` when hardware enrolled

### Web

- `autocomplete="email" | "tel" | "one-time-code" | "name"`
- WebOTP when `OTPCredential` exists
- Contact Picker API when `navigator.contacts` exists; otherwise hide suggest / import copy

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

Configure Google / Apple / LinkedIn providers, redirect URLs, passkeys, One Tap client ID,
Android SMS hash, and QR login Edge Function in the Supabase dashboard.
See [AUTH_SOCIAL_SESSIONS.md](./AUTH_SOCIAL_SESSIONS.md) for the full platform checklist
(One Tap, Phone Hint, SMS Retriever, biometrics, QR).

## Privacy notes

- No silent SMS/email/contact reads
- Contact permission only after **Select contacts** / **Use contact details**
- Import requires explicit consent timestamp
- Skip is always available; registration is not blocked
- Do not log OTP, tokens, or contact payloads in analytics
- Location request is soft-fail and optional during prefs

## Manual test plan

1. Web email OTP — autofill / paste 6 digits — auto verifies
2. Web phone OTP — manual entry when WebOTP unsupported
3. Android — SMS suggestion fills OTP field without SMS permission
4. iOS — keyboard OTP suggestion
5. Google / Apple sign-in → name/photo prefilled on basics step
6. Prefs → Use device language + Use my location
7. Basics → Choose photo / Take photo (native) uploads avatar
8. Basics → Use contact details → confirm → name/phone filled
9. Deny contacts permission → graceful message / Skip
10. Finish → optional network contact import CTA → Skip lands in app
11. Native DOB picker saves `date_of_birth`
12. iOS/Android — unlink social / delete passkey / sign out all prompts biometrics when enrolled
13. Web — sensitive actions keep ConfirmDialog only

## Known limitations

- Full Android SMS Retriever native listener is not bundled; OS autofill + hash env are used
- Some Android versions fall back to an in-app select list after permission (still uploads only selected rows)
- Contact Picker API is Chromium/HTTPS-only on web
- Webcam capture for avatar is not shipped on web (library upload only)
- Supabase session storage remains AsyncStorage on native (JWT size); rotate keys via Supabase Auth
