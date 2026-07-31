# Google Play — No Android Foreground Services + Target API 36

Use this when resubmitting after **Permissions for Foreground Services** rejections and target-API warnings.

## Why we removed FGS (Jul 2026)

Play rejected `phoneCall` / `microphone` / `mediaProjection` for SHEconomy with:

- Permission use not declared or incorrectly declared
- Functionality not initiated by or perceptible to the user
- Insufficient demonstration of use
- Lack of material user impact

For a marketplace app, ConnectionService + MediaProjection FGS are not core. The Android AAB now **declares zero typed FGS permissions**.

| Platform | Calls | Screen share |
|----------|-------|--------------|
| Android | In-app overlay + push (no CallKeep FGS) | Disabled |
| iOS | CallKit | Broadcast Extension |
| Web | In-app | Browser screen share |

## Engineering checklist (in repo)

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, `compileSdkVersion` **36**; no `FOREGROUND_SERVICE_*` in `android.permissions`
- LiveKit / expo-livekit-screen-share Android screen-share flags **false**
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — **iOS only** (no Android ConnectionService)
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin; `tools:node=remove` for:
  - `VoiceConnectionService` / CallKeep messaging service
  - `MediaProjectionService` (merged from WebRTC even when unused)
  - `LocationTaskService`
  - All `FOREGROUND_SERVICE*` + telecom call permissions
- Verify: `yarn verify:android-fgs`

## Play Console steps

1. Upload new production AAB (`versionCode` ≥ 119).
2. App bundle explorer: confirm **Target SDK = 36**.
3. App bundle explorer / App content → Foreground service permissions:
   - Confirm the new bundle does **not** list `FOREGROUND_SERVICE_PHONE_CALL`, `_MICROPHONE`, or `_MEDIA_PROJECTION`.
   - If the form still shows old types from a previous upload, answer that this release no longer uses them / clear declarations for the new release as Play allows.
4. Submit the new release for review.

Do **not** re-declare phoneCall / microphone / mediaProjection FGS for Android unless you restore those services and ship a demo video that clearly shows core use.
