# Human Verification — Developer Guide

SHEconomy is **women-first**. Full community and seller access is gated behind an
on-device **Human verification** check (face liveness + gender estimate). Everything
lives under **`lib/gender-verification/`** (logic) and
**`components/gender-verification/`** (UI), and the app-wide prompt is mounted
once in the global shell.

> **TL;DR** — The check runs entirely on the device: a **3-blink MediaPipe**
> liveness test plus a bundled face model for the gender estimate. Only the
> resulting *scores* are sent to Supabase (never the video). The UI is titled
> **Human verification** and opens **only on intent** (Community / Chat /
> Create store — auth first if guest). It does **not** auto-prompt after login.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/gender-verification/constants.ts` | Tunables: `GENDER_VERIFICATION`, `GENDER_VERIFICATION_PROMPT` (`?human=verify`, returnTo), `HUMAN_VERIFICATION_DISCLAIMER` |
| `lib/gender-verification/blink.ts` | Blink tracker + liveness scoring (EAR-based) |
| `lib/gender-verification/landmarks.ts` | MediaPipe Face Mesh helpers (face detection, eye-aspect-ratio, centering) |
| `lib/gender-verification/gender-estimate.ts` | On-device gender estimate from the video frame |
| `lib/gender-verification/api.ts` | Supabase RPC wrappers (`create_…` / `complete_gender_verification_session`) |
| `lib/gender-verification/errors.ts` | **Centralised error handling** — `GenderVerificationError`, `GENDER_ERROR_CODES`, `toFriendlyGenderError()` (incl. **413 → "step back"**) |
| `lib/gender-verification/denied-redirect.ts` | `buildHumanVerificationOpenRedirect` / `buildVerificationDeniedRedirect` |
| `hooks/useGenderVerification.ts` (`.web` / `.native`) | The verification state machine (`phase`, `start`, `reset`, blink progress, camera refs) |
| `components/gender-verification/GenderVerificationPanel.tsx` | Shared presentational pieces: `VerificationSteps`, `FaceCaptureOverlay` |
| `components/gender-verification/GenderVerificationScreen.tsx` | Full-page flow (route `/auth/verify-gender`) |
| `components/gender-verification/GenderVerificationModal.tsx` | **App-wide popup** version of the flow |
| `components/gender-verification/GenderDeniedModal.tsx` | "Access restricted" modal for non-intent gated surfaces |
| `components/gender-verification/GenderVerificationErrorBoundary.tsx` | Error boundary that renders friendly errors + retry |
| `components/gender-verification/GenderVerificationHost.tsx` | **Glue** — intent-only (`?human=verify`), denied (`?gender=restricted`), returnTo after success |

The host is mounted once near the shell root (`components/navigation/app/AppShell.tsx`),
so the prompt works on every non-auth screen without per-page wiring.

---

## 2. When the prompt appears

`GenderVerificationHost` is **intent-only** (no auto-show after login):

1. **Community / Chat / Create store** — guest → sign-in with `returnTo`; signed-in
   limited member → `?human=verify` opens the Human verification modal (skips the
   access-restricted modal for these entry points).
2. **Post-auth return** — if `returnTo` was Community / Chat / Create store and the
   member is still limited, `sanitizeReturnPath` opens Human verification instead of
   silently dropping the intent.
3. **Other gated surfaces** (e.g. account) may still use `?gender=restricted` →
   `GenderDeniedModal`, which offers “Start human verification”.
4. **On success**, profile is refreshed and the member is sent to the remembered
   `returnTo` when present.

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
| Face read too unsteady to judge | `LOW_CONFIDENCE_RETRY` | Lighting / glasses guidance, worth retrying |
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

## 4b. How the gender decision is made

The on-device model returns a label plus the confidence of *that* label, and the
label flips between frames as lighting, head angle, and blinks change. Judging a
single frame therefore rejected real women at random, so the verdict is now an
aggregate (`lib/gender-verification/gender-aggregate.ts`):

1. Every frame that carries a gender read is collected during the session. On web
   `detectHumanLivenessFrame` samples every 6th frame; on native every
   `nativeGenderSampleEvery`-th frame uses the analyzer's `both` mode, which
   returns gender *and* anti-spoof from one pass so the liveness averages keep
   filling.
2. Each read becomes a female probability — a male label at 0.8 counts as 0.2
   female.
3. The single lowest and highest probabilities are dropped once there are 5+
   reads, so one bad frame cannot decide the run, and the remaining mean is
   compared against `minGenderConfidence`. The labels must also be female-majority,
   so a couple of very confident frames cannot outvote a mostly-male read.
4. A mean within `genderBorderlineBand` of the bar (or fewer than
   `minGenderSamples` reads) buys **one** extra sampling round rather than a
   rejection. If it is still unclear after that, the user gets the retryable
   `LOW_CONFIDENCE_RETRY` guidance instead of the women-first rejection.

The aggregated mean is what gets sent to `complete_gender_verification_session`,
and the RPC gates on the same number. `minGenderConfidence` in `constants.ts` and
`v_min_gender_confidence` in
`supabase/migrations/20260812150000_align_gender_verification_confidence.sql`
must be changed together — a mismatch means the app accepts a run the server then
rejects with different wording.

---

## 5. Tuning

Change behavior by editing **`lib/gender-verification/constants.ts`** only:

- `GENDER_VERIFICATION.requiredBlinks` — number of blinks (default **3**).
- `GENDER_VERIFICATION.earBlinkThreshold` / `earOpenThreshold` — blink sensitivity.
- `GENDER_VERIFICATION.minLivenessScore` / `minGenderConfidence` — pass bars
  (`minGenderConfidence` is mirrored in SQL — see section 4b).
- `GENDER_VERIFICATION.minGenderSamples` / `extraGenderSamples` /
  `genderBorderlineBand` / `extraGenderSamplingMs` — how many reads the verdict
  needs and how long the follow-up round may run.
- `GENDER_VERIFICATION.nativeGenderSampleEvery` — native gender sampling cadence.
- `GENDER_VERIFICATION_PROMPT.dismissCooldownMs` — quiet window (default **10 min**).
- Gender-restricted routes live in `config/route-protection.config.ts`
  (`GENDER_RESTRICTED_ROUTES`).
