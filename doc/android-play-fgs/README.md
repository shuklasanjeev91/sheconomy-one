# Google Play — Foreground Services + Target API 36

Play previously rejected unused FGS types (`phoneCall`, `microphone`,
`camera`, `location`). Those stay stripped.

**MediaProjection is re-enabled** for Co-Work Present on Android:
user taps Present → system capture consent → ongoing share notification.

| Platform | Calls | Screen share (Present) |
|----------|-------|------------------------|
| Android | In-app overlay + push (no CallKeep FGS) | MediaProjection FGS (user-initiated) |
| iOS | CallKit | Broadcast Extension |
| Web | In-app | Browser screen share |

## Engineering checklist (in repo)

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, `compileSdkVersion` **36**
  - Declare `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION` only
  - LiveKit / expo-livekit-screen-share Android screen-share flags **true**
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — **iOS only**
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin:
  - `tools:node=remove` for CallKeep / location / mic / phoneCall FGS
  - Keep MediaProjectionService + `ENABLE_SCREEN_SHARE_SERVICE=true`
- Verify: `yarn verify:android-fgs`

## Play Console steps

1. Upload production AAB with a bumped `versionCode`.
2. App bundle explorer: confirm **Target SDK = 36**.
3. Foreground service permissions: declare **mediaProjection** only.
4. Attach a short demo: user taps Present → system capture sheet → share notification visible.
5. Submit for review.

OTA cannot ship MediaProjection — Android Present needs this native AAB.

Build **171+** also patches a MediaProjection race (FGS must be foreground
before `startCapture`) that otherwise published blank tracks ~40–60% of the time.
