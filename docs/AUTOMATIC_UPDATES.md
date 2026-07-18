# Automatic Over-the-Air (OTA) Updates

Production-ready OTA updates for SHEconomy One (OneFramework + Expo) on **Android** and **iOS**. **Web** continues to use normal CDN / hosting deploys; `expo-updates` is not used in the browser.

## Architecture overview

```text
App launch / resume (native)
        │
        ▼
AutomaticUpdateManager.native
        │
        ├─► RemoteUpdateConfig (EXPO_PUBLIC_UPDATE_CONFIG_URL)
        │       • maintenanceMode → MaintenanceScreen
        │       • minimumSupportedVersion → MandatoryStoreUpdateScreen
        │       • critical flag for downloaded bundles
        │
        └─► expo-updates
                checkForUpdateAsync → fetchUpdateAsync → prompt → reloadAsync
```

| Layer | Role |
| --- | --- |
| `lib/updates/*` | Version compare, remote config, AsyncStorage metadata, check/download/apply orchestration |
| `components/system/AutomaticUpdateManager.native.tsx` | AppState + UX prompts on iOS/Android |
| `components/system/AutomaticUpdateManager.web.tsx` | Maintenance gate only (no expo-updates) |
| EAS Update channels | `development`, `preview`, `production` |

**Runtime policy:** `runtimeVersion.policy = appVersion` — OTA bundles only apply to native binaries with the same app `version` in `app.json`.

Failed downloads leave the previous cached bundle running. A reload guard limits crash loops for a bad update id.

## Setup requirements

1. Install / confirm dependency: `expo-updates` (already wired via `npx expo install expo-updates`).
2. Expo project is already linked:

| Field | Value |
| --- | --- |
| Account | `sheconomy` |
| Project | `@sheconomy/sheconomy` (SHEconomy) |
| Project ID | `61412da1-9fab-4374-83f5-9e7eba296400` |
| GitHub | `https://github.com/shuklasanjeev91/sheconomy-one` |
| iOS bundle | `com.sheconomy.ecommerce` |
| Android package | `com.sheconomy.ecommerce` |
| Apple Team | `52H73QK4CL` |
| Updates URL | `https://u.expo.dev/61412da1-9fab-4374-83f5-9e7eba296400` |

If you need to re-link later:

```bash
npx eas login
npx eas init --id 61412da1-9fab-4374-83f5-9e7eba296400 --force
npx eas update:configure
```

3. Rebuild native binaries after first enabling Updates (store or internal build) so the installed app includes the Updates runtime.
4. Publish JS/asset updates with `eas update --channel <channel>` (or the yarn scripts below).

## Git ↔ OTA integration

| Git event | What happens |
| --- | --- |
| Push / merge to `main` | GitHub Action publishes OTA to EAS channel **`production`** |
| Open / update a PR (non-draft) | GitHub Action runs `eas update --auto` and comments a QR / preview link |
| Local publish | `yarn update:production` / `yarn update:preview` / `yarn update:auto` |

### One-time: Expo token for GitHub

1. Create a token at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
2. In GitHub → **Settings → Secrets and variables → Actions**, add `EXPO_TOKEN`.
3. Workflows live at:
   - [`.github/workflows/eas-update-production.yml`](../.github/workflows/eas-update-production.yml)
   - [`.github/workflows/eas-update-preview.yml`](../.github/workflows/eas-update-preview.yml)

Without `EXPO_TOKEN`, CI will fail fast with a clear message (web deploys on Vercel are unaffected).

### Local yarn scripts

```bash
yarn update:development   # eas update --channel development
yarn update:preview       # eas update --channel preview
yarn update:production    # eas update --channel production
yarn update:auto          # branch + message from current git commit
```

`--auto` maps the current **Git branch** to an EAS Update branch and uses the latest commit message.

### Channel ↔ build profile map

| EAS build profile (`eas.json`) | Update channel |
| --- | --- |
| `development` | `development` |
| `preview` | `preview` |
| `production` | `production` |

Store / internal binaries must be built with the matching profile so OTA lands on the right devices.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_APP_ENV` | `development` \| `preview` \| `production` label |
| `EXPO_PUBLIC_UPDATE_CONFIG_URL` | HTTPS JSON endpoint for `RemoteUpdateConfig` |
| `EXPO_PUBLIC_IOS_APP_STORE_URL` | App Store deep link for mandatory store updates |
| `EXPO_PUBLIC_ANDROID_PLAY_STORE_URL` | Play Store deep link for mandatory store updates |

Example remote JSON (`public/update-config.example.json`):

```json
{
  "minimumSupportedVersion": "1.20.0",
  "latestVersion": "1.20.1",
  "critical": false,
  "maintenanceMode": false,
  "maintenanceMessage": "We are performing scheduled maintenance. Please try again shortly."
}
```

Host this file on Supabase Storage, an edge function, Vercel, or any CDN. Do not hardcode production URLs in source.

## Development workflow

```bash
yarn dev
```

`AutomaticUpdateManager` **skips** OTA checks when `__DEV__` / development is true. Use Expo Go / a local build without applying published updates during day-to-day coding.

Publish a development-channel update for device internal builds:

```bash
eas update --channel development --message "Development update"
```

## Preview deployment workflow

1. Build an internal preview binary (once per native change):

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

2. Ship JS / UI changes:

```bash
eas update --channel preview --message "Preview update"
```

## Production deployment workflow

1. Ship store binaries when native code changes (see limitations below):

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
eas submit --profile production
```

2. Ship OTA (compatible JS/TS/UI/logic):

```bash
eas update --channel production --message "Production update"
```

Clients check on launch (`ON_LOAD`) and again when returning from background. Compatible updates download silently; users restart via the in-app prompt (critical updates cannot be dismissed).

## Rollback procedure

1. **Republish last known good bundle** to the same channel:

```bash
eas update --channel production --message "Rollback to previous good build" --input-dir <path-or-use-replay>
```

Prefer EAS dashboard → Updates → **Republish** for the prior successful update group.

2. Clients that already downloaded a bad bundle still run the last successful load if reload fails; the reload guard stops infinite restart loops. Users can clear the app and reopen to fetch the republished channel head if needed.

3. Never clear the working updates cache from app code.

## Native update limitations

OTA **is** for:

- React components, JS/TS, UI/layout
- API clients, business logic, content, remote config
- Bundled assets compatible with the current native runtime

OTA **is not** for:

- New native modules / SDK upgrades
- Android permissions or iOS entitlements
- App icon / native splash changes
- Minimum OS version changes
- Native payment, camera, maps, push, biometric library changes

Those require bumping `expo.version` (and store build numbers), then new Play Store / App Store binaries. Because runtime policy is `appVersion`, OTA packages for the new version will not install on old binaries (and vice versa).

## Store-build requirements

Create a new store build when:

- You add/remove native dependencies (e.g. LiveKit, OneSignal, camera)
- You change `app.json` native plugins / permissions / entitlements
- You change icons, splash, bundle identifiers
- You need clients below `minimumSupportedVersion` to upgrade via the stores

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No updates download | Binary was built with Updates configured; channel matches build profile; `runtimeVersion` matches app version |
| Updates skipped locally | Expected in `__DEV__` |
| Always see store screen | Native version &lt; remote `minimumSupportedVersion` |
| Maintenance wall | Remote `maintenanceMode: true` |
| Prompt never appears | User chose Later for that update id; or check failed (app keeps cached version) |
| Crash loop after reload | Reload guard blocks further auto-apply for that update id; republish a good update |

Useful commands:

```bash
eas channel:list
eas update:list --channel production
npx expo-updates configuration:status
```

## Commands cheat sheet

```bash
# OTA (yarn wrappers)
yarn update:development
yarn update:preview
yarn update:production
yarn update:auto

# OTA (raw)
eas update --channel development --message "Development update"
eas update --channel preview --message "Preview update"
eas update --channel production --message "Production update"

# Native binaries
eas build --profile development --platform android
eas build --profile preview --platform ios
eas build --profile production --platform all

# Unit tests for update orchestration
yarn test:unit
```

## Integration points in this repo

- Root layout: `app/_layout.tsx` mounts `<AutomaticUpdateManager />`
- Config: `app.json` → `runtimeVersion` + `updates` (`checkAutomatically: ON_LOAD`)
- EAS profiles: `eas.json` (`build.*.channel` + `update.*`)
- GitHub Actions: `.github/workflows/eas-update-*.yml`
- Logic: `lib/updates/*`
- UI: `components/system/*`
