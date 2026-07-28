# Progressive Web App (PWA)

SHEconomy’s web app is installable as a standalone PWA on desktop and mobile browsers.

## What ships

| Piece | Location |
| --- | --- |
| Web app manifest | [`public/manifest.webmanifest`](../public/manifest.webmanifest) |
| Icons (192 / 512) | `public/pwa-icon-192.png`, `public/pwa-icon-512.png` |
| Offline fallback | [`public/offline.html`](../public/offline.html) |
| Service worker | [`public/OneSignalSDKWorker.js`](../public/OneSignalSDKWorker.js) (OneSignal push **+** shell cache) |
| Registration | [`lib/pwa/register.ts`](../lib/pwa/register.ts), [`components/pwa/PwaBootstrap.tsx`](../components/pwa/PwaBootstrap.tsx) |
| Install UI | Settings → About → **Install SHEconomy** (when the browser offers a prompt) |

## Browser requirements

Installability needs HTTPS (or `localhost`), a valid manifest, and a controlling service worker with a `fetch` handler. Chrome / Edge / Android Chrome show an install affordance; Safari on iOS uses **Share → Add to Home Screen**.

## Offline behavior

- Navigations: **network-first**; if the network fails, serve `/offline.html`.
- Precached assets: icons, manifest, offline page (cache-first).
- App data / API calls are **not** fully cached — users still need connectivity for feed, cart, chat, etc.

## OneSignal coexistence

Push and PWA share one root-scope worker so we do not fight over `/`. Do not register a second SW at `/` unless it also `importScripts` the OneSignal SDK worker.

## Verify locally

1. `yarn dev` → open `http://localhost:8081/`
2. DevTools → Application → Manifest (icons, start_url, theme)
3. Application → Service Workers → `OneSignalSDKWorker.js` should be activated
4. Chrome → Install app (⋮ menu) or wait for `beforeinstallprompt` and use **Settings → About → Install**
