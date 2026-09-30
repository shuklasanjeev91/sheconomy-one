# Deep Links — Android App Links & iOS Universal Links

Goal: tapping `https://www.sheconomy.in/co-work/meeting/961-O0F-8NS/live` in
WhatsApp opens the **installed app** on that screen, and opens the **website**
only when the app is not installed.

Run the doctor before debugging anything by hand:

```bash
yarn verify:deep-links
```

It checks the intent filters, both association files, Google's and Apple's
verifiers, your local signing certificates, and — when a device is plugged in —
the on-device verification state.

---

## 1. How a tap is resolved

There is no JavaScript involved in the decision. The OS decides:

1. The OS looks up the link's **host** against the app's declared domains.
2. It fetches an association file from that host and checks it names this exact
   app **and this exact signing certificate**.
3. Only if that succeeds does the OS launch the app with the URL. Otherwise a
   browser opens, and no amount of app code can change that.

Once the app is launched, One Router turns the URL into a route. That half
already works: the https prefixes are registered in `babel.config.cjs`,
`metro.config.cjs` (native) and `vite.config.ts` (web), and
`components/system/UniversalLinksHost.tsx` is a fallback for URLs the router
misses.

## 2. The two association files

Both live in `public/.well-known/` and deploy with the web app.

| File | Platform | Must contain |
|---|---|---|
| `assetlinks.json` | Android | `com.sheconomy.ecommerce` + SHA-256 of the signing cert |
| `apple-app-site-association` | iOS | `52H73QK4CL.com.sheconomy.ecommerce` |

**Neither fetcher follows redirects.** A host that answers `301`/`308` can never
be verified. This is the single most common cause of "it just opens the
browser".

## 3. Known constraint: `sheconomy.in` cannot be verified

`https://sheconomy.in/*` returns `308 → https://www.sheconomy.in/*`. That
redirect is a **Vercel project domain setting**, not something in this repo, so
Google's verifier rejects the apex outright:

```
ERROR_CODE_REDIRECT — redirects are disallowed for security reasons
```

Because of this:

- The Android `autoVerify` intent filter declares **only `www.sheconomy.in`**.
  On Android 11 and lower a single unverifiable host in the manifest disables
  App Links for *every* host, so leaving the apex in would break older phones.
- `config/app-origin.ts` exports `DEEP_LINK_ORIGIN = 'https://www.sheconomy.in'`
  and `buildAppUrl()` uses it, so every share link, invite, and QR code the app
  hands out points at the host that can actually be verified.
  `DEFAULT_APP_ORIGIN` stays on the apex for payment callbacks, SEO, and
  Supabase-stored URLs, which already canonicalize there.

### Re-enabling the apex (optional)

In Vercel → Project → Settings → Domains, make `sheconomy.in` serve the
deployment instead of redirecting to `www`. Then add it back to
`app.json → expo.android.intentFilters` **as its own filter** (never merged with
`www` into one filter) and re-run `yarn verify:deep-links`.

## 4. Signing certificates — the other common failure

`assetlinks.json` must list the SHA-256 of the certificate that signed the
**installed** binary. Different builds use different certificates:

| Install source | Signed by | In `assetlinks.json`? |
|---|---|---|
| Play Store | Play App Signing key | **required** |
| EAS internal / preview APK | EAS-managed keystore | required to test that build |
| `yarn android` local build | `android/app/debug.keystore` | required to test locally |

Get the Play value from **Play Console → Test and release → Setup → App signing
→ App signing key certificate → SHA-256**, and the EAS value from
`eas credentials -p android`. Add each as another entry in the
`sha256_cert_fingerprints` array:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.sheconomy.ecommerce",
      "sha256_cert_fingerprints": [
        "71:16:DF:...",
        "<Play App Signing SHA-256>"
      ]
    }
  }
]
```

Deploy the web app after editing — the file is read from the live domain, not
from the repo.

## 5. Testing on a real device

### Android

```bash
# Force re-verification without reinstalling (Android 12+)
adb shell pm verify-app-links --re-verify com.sheconomy.ecommerce

# Inspect the result — look for "verified" next to www.sheconomy.in
adb shell pm get-app-links com.sheconomy.ecommerce

# Simulate the tap
adb shell am start -a android.intent.action.VIEW \
  -d "https://www.sheconomy.in/co-work/meeting/961-O0F-8NS/live"
```

If the domain shows `legacy_failure` or `none`, the association file or the
fingerprint is wrong. While testing a debug build you can approve the domain
manually:

```bash
adb shell pm set-app-links --package com.sheconomy.ecommerce 1 www.sheconomy.in
```

### iOS

Universal Links only work on a **device** (not the Simulator) and the build must
carry the Associated Domains entitlement — already declared in
`app.json → expo.ios.associatedDomains`.

```bash
xcrun simctl openurl booted "https://www.sheconomy.in/co-work/meeting/961-O0F-8NS/live"
```

iOS caches the association file aggressively. After changing it, delete and
reinstall the app, or toggle Airplane mode, to force a refetch.

## 6. In-app browsers (WhatsApp, Instagram, Facebook)

Even a perfectly verified link can be swallowed:

- **iOS**: links opened inside an app's embedded browser never trigger Universal
  Links. Only the `sheconomy://` scheme escapes.
- **Android**: WhatsApp uses a Chrome Custom Tab, which usually honours verified
  App Links but not always.

`components/system/OpenInAppHost.web.tsx` covers this. When the web page loads
on a phone it shows an "Open in SHEconomy" bar and makes one silent handoff
attempt, chosen so it can never hurt a visitor who does not have the app:

- Android uses a scheme-only `intent://` URL (`buildAndroidAutoIntentUrl`) with
  no `package` and no `browser_fallback_url`. Naming a package makes Chrome
  redirect to the Play Store when the app is missing, which would hijack every
  mobile-web visitor. Without it the intent simply does nothing.
- iOS only auto-attempts inside a detected in-app browser, where Universal Links
  cannot work anyway. In real Safari the scheme would raise "address is invalid"
  for visitors without the app, so there the banner button is the only trigger.

The banner's **Open** button still uses the full intent with the Play Store
fallback, because that is an explicit user action.

## 7. Cold start into a meeting: `DOMException` on Hermes

A verified link launches the app *directly* on the linked route, so
`/co-work/meeting/:code/live` can be the very first screen Hermes evaluates —
before any Co-Work screen has had a chance to prepare globals. Hermes ships no
`DOMException`, and the WebRTC stack references it while its modules evaluate
(`extends DOMException` at module scope), which made that cold start fail with:

```
ERROR  [ReferenceError: Property 'DOMException' doesn't exist]
```

The same code path works when you reach a meeting by tapping through the app,
because an earlier screen has already installed the polyfill by then. Only the
deep-link cold start is exposed.

`lib/polyfills/install-dom-exception.ts` is a side-effect module that installs
the polyfill, and `lib/polyfills-side-effects.native.ts` imports it first — that
bundle is the One `setupFile` (`metro.config.cjs`, `vite.config.ts`), so it runs
before any route module.

The ordering matters and is easy to break: **a guard has to be an `import`, not a
function call**. ES import bindings hoist above every statement, so a
`ensureWebRTCGlobals()` line sitting between two imports still runs *after*
`react-native-webrtc` has been evaluated. `tests/unit/polyfills/dom-exception.test.ts`
asserts the source order for the setup bundle and for each module that imports
WebRTC eagerly.

## 8. Files involved

| File | Role |
|---|---|
| `app.json` | `scheme`, `ios.associatedDomains`, `android.intentFilters` |
| `android/app/src/main/AndroidManifest.xml` | Generated from `app.json` by prebuild |
| `ios/SHEconomy/SHEconomy.entitlements` | Generated `com.apple.developer.associated-domains` |
| `public/.well-known/assetlinks.json` | Android association |
| `public/.well-known/apple-app-site-association` | iOS association |
| `vercel.json` | Content-Type headers for both files |
| `config/app-origin.ts` | `DEEP_LINK_ORIGIN`, `getAppLinkingPrefixes`, `buildAppUrl` |
| `babel.config.cjs`, `metro.config.cjs`, `vite.config.ts` | One Router linking prefixes |
| `components/system/UniversalLinksHost.tsx` | Native fallback router handoff |
| `components/system/OpenInAppHost.web.tsx` | Mobile-web handoff banner |
| `scripts/verify-deep-links.cjs` | `yarn verify:deep-links` |

> `android/` and `ios/` are gitignored and regenerated by `yarn prebuild:native`.
> `app.json` is the source of truth — always change it there.
