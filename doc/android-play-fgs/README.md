# Google Play — Foreground Services + Target API 36

Use this when shipping Co-Work screen share on Android and keeping CallKeep/telecom FGS out of the AAB.

## Policy split (Jul 2026 → restored MediaProjection)

Play previously rejected `phoneCall` / `microphone` / `mediaProjection` for SHEconomy. CallKeep ConnectionService is still **not** core for the Android marketplace listing, so those types stay stripped.

**MediaProjection is restored** so Co-Work **Present** can show the system screen-capture sheet and keep a perceptible “sharing screen” notification while presenting.

| Platform | Calls | Screen share |
|----------|-------|--------------|
| Android | In-app overlay + push (no CallKeep FGS) | MediaProjection FGS (user-initiated) |
| iOS | CallKit | Broadcast Extension |
| Web | In-app | Browser screen share |

## Engineering checklist (in repo)

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, `compileSdkVersion` **36**
  - Declare `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`
  - LiveKit / expo-livekit-screen-share Android screen-share flags **true**
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — **iOS only** (no Android ConnectionService)
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin:
  - `tools:node=remove` for CallKeep / location FGS + phone telecom permissions
  - **Keeps** `MediaProjectionService` + MediaProjection permission + `ENABLE_SCREEN_SHARE_SERVICE=true`
- Verify: `yarn verify:android-fgs`

## Play Console steps

1. Upload production AAB with a bumped `versionCode`.
2. App bundle explorer: confirm **Target SDK = 36**.
3. Foreground service permissions:
   - Expect **`mediaProjection`** only (for Co-Work Present).
   - Do **not** declare phoneCall / microphone / camera FGS unless you restore those services.
4. Attach a short demo video: join Co-Work meeting → tap Present → system capture prompt → ongoing share notification → stop share.
5. Submit for review.

Do **not** re-declare phoneCall / microphone FGS for Android unless you restore CallKeep ConnectionService and ship a matching demo.
