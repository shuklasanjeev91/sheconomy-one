# Gender Verification — Developer Guide

SHEconomy is **women-first**. Full community and seller access is gated behind an
on-device **face liveness + gender** check. Everything lives under
**`lib/gender-verification/`** (logic) and
**`components/gender-verification/`** (UI), and the app-wide prompt is mounted
once in the global shell.

> **TL;DR** — The check runs entirely on the device: a **3-blink MediaPipe**
> liveness test plus a bundled face model for the gender estimate. Only the
> resulting *scores* are sent to Supabase (never the video). An authenticated
> member with `profiles.is_verified === false` is prompted automatically via a
> dismissible modal; every failure is turned into a friendly, actionable message.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/gender-verification/constants.ts` | Tunables: `GENDER_VERIFICATION` (blink count, thresholds), `GENDER_VERIFICATION_PROMPT` (cooldown, storage key, restricted flag), `VerificationPhase` type |
| `lib/gender-verification/blink.ts` | Blink tracker + liveness scoring (EAR-based) |
| `lib/gender-verification/landmarks.ts` | MediaPipe Face Mesh helpers (face detection, eye-aspect-ratio, centering) |
| `lib/gender-verification/gender-estimate.ts` | On-device gender estimate from the video frame |
| `lib/gender-verification/api.ts` | Supabase RPC wrappers (`create_…` / `complete_gender_verification_session`) |
| `lib/gender-verification/errors.ts` | **Centralised error handling** — `GenderVerificationError`, `GENDER_ERROR_CODES`, `toFriendlyGenderError()` (incl. **413 → "step back"**) |
| `hooks/useGenderVerification.ts` (`.web` / `.native`) | The verification state machine (`phase`, `start`, `reset`, blink progress, camera refs) |
| `components/gender-verification/GenderVerificationPanel.tsx` | Shared presentational pieces: `VerificationSteps`, `FaceCaptureOverlay` |
| `components/gender-verification/GenderVerificationScreen.tsx` | Full-page flow (route `/auth/verify-gender`) |
| `components/gender-verification/GenderVerificationModal.tsx` | **App-wide popup** version of the flow |
| `components/gender-verification/GenderDeniedModal.tsx` | "Access restricted" modal for women-first features |
| `components/gender-verification/GenderVerificationErrorBoundary.tsx` | Error boundary that renders friendly errors + retry |
| `components/gender-verification/GenderVerificationHost.tsx` | **Glue** — decides *when* the modals appear (auto-show / cooldown / route / `?gender=restricted`) |

The host is mounted once near the shell root (`components/navigation/app/AppShell.tsx`),
so the prompt works on every non-auth screen without per-page wiring.

---

## 2. When the prompt appears

`GenderVerificationHost` reads the signed-in `profile` and the current path and
applies these rules (all timings come from `GENDER_VERIFICATION_PROMPT` — nothing
is hardcoded in components):

1. **Auto-show** when `isAuthenticated && profile.is_verified === false`.
2. **Don't nag.** After the member closes the modal, stay quiet for
   `dismissCooldownMs` (**10 minutes**). The dismissal timestamp is persisted
   cross-platform via `persistStorage` under `dismissStorageKey`.
3. **Re-prompt on intent.** If the member navigates to a **gender-restricted
   route** (`requiresGenderVerification(pathname)` — e.g. `/vendor`,
   `/create-listing`), the modal opens immediately, bypassing the cooldown.
4. **Restricted flag.** A `?gender=restricted` query opens `GenderDeniedModal`
   and the URL is cleaned up (web).
5. **On success**, the profile is refreshed and the dismissal record is cleared,
   so a future unverified state prompts fresh.

Suppressed on `/auth/*` (the full-page `/auth/verify-gender` owns its own UI) and
`/ui-kit`. The host is only mounted in the main app chrome, so meetings / kiosk
routes are never interrupted.

```tsx
// Mounted for you in AppShell — no action needed in feature screens.
<GenderVerificationHost />
```

---

## 3. The flow itself (3 blinks, MediaPipe)

Driven by `useGenderVerification`. The `phase` moves through:

`idle → loading → camera → position → blink → analyze → success | error`

- **`blink`** requires `GENDER_VERIFICATION.requiredBlinks` (**3**) natural blinks,
  detected from the eye-aspect-ratio via MediaPipe Face Mesh landmarks.
- **`analyze`** estimates gender on-device and submits **only scores** to Supabase.
- The video stream is stopped automatically when the hook unmounts, so closing
  the modal releases the camera.

To embed the flow yourself, reuse the shared panel pieces:

```tsx
const v = useGenderVerification({ onVerified: () => refreshProfiles() })

<VerificationSteps phase={v.phase} />
<FaceCaptureOverlay
  containerRef={v.containerRef}
  phase={v.phase}
  instruction={v.instruction}
  blinkCount={v.blinkCount}
  requiredBlinks={v.requiredBlinks}
/>
<Button onPress={() => void v.start()}>Start verification</Button>
```

---

## 4. Errors & the 413 case

All user-facing copy flows through `toFriendlyGenderError(error)`:

| Situation | Code | Message shown |
|-----------|------|---------------|
| **413 / "face image too large"** | `IMAGE_TOO_LARGE` | *"Your face is too close… move back a little…"* |
| Camera permission blocked | `CAMERA_DENIED` | Ask to allow camera permission |
| No camera / in use | `CAMERA_UNAVAILABLE` | Free the camera and retry |
| Face not clearly seen | `FACE_NOT_DETECTED` | Lighting + centering guidance |
| Liveness incomplete | `LIVENESS_FAILED` | Hold still and blink again |
| Confidence too low / not eligible | `NOT_ELIGIBLE` | Women-first explanation |
| Rate limited / network / timeout | `RATE_LIMITED` / `NETWORK` / `TIMEOUT` | Retry guidance |

The classifier inspects both an HTTP-ish `status` (e.g. `413`, `429`) and known
message fragments, so it keeps working if a server-side Face++ step is added later.

Wrap any verification UI in the boundary so render-time crashes still surface a
friendly message + retry:

```tsx
<GenderVerificationErrorBoundary scope="Modal" onReset={v.reset}>
  {/* verification UI */}
</GenderVerificationErrorBoundary>
```

---

## 5. Tuning

Change behavior by editing **`lib/gender-verification/constants.ts`** only:

- `GENDER_VERIFICATION.requiredBlinks` — number of blinks (default **3**).
- `GENDER_VERIFICATION.earBlinkThreshold` / `earOpenThreshold` — blink sensitivity.
- `GENDER_VERIFICATION.minLivenessScore` / `minGenderConfidence` — pass bars.
- `GENDER_VERIFICATION_PROMPT.dismissCooldownMs` — quiet window (default **10 min**).
- Gender-restricted routes live in `config/route-protection.config.ts`
  (`GENDER_RESTRICTED_ROUTES`).
