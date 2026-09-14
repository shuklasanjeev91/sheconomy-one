# Google Play — Foreground Services + Target API 36

Play rejected this marketplace listing for foreground-service types
(`phoneCall`, `microphone`, and later `mediaProjection`): permission not
declared correctly, interruption without material user impact, and
functionality not user-initiated / not perceptible.

The Android AAB therefore **declares no FGS types**.

| Platform | Calls | Screen share (Present) |
|----------|-------|------------------------|
| Android | In-app overlay + push (no CallKeep FGS) | Disabled — present from iOS or web |
| iOS | CallKit | Broadcast Extension |
| Web | In-app | Browser screen share |

## Engineering checklist (in repo)

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, `compileSdkVersion` **36**
  - Do **not** declare `FOREGROUND_SERVICE*` permissions
  - LiveKit / expo-livekit-screen-share Android screen-share flags **false**
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — **iOS only**
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin:
  - `tools:node=remove` for CallKeep, location, and WebRTC MediaProjection FGS
  - `ENABLE_SCREEN_SHARE_SERVICE=false`
- Verify: `yarn verify:android-fgs`

## Play Console steps

1. Upload production AAB with a bumped `versionCode`.
2. App bundle explorer: confirm **Target SDK = 36**.
3. Foreground service permissions: **none**. If a previous declaration exists, remove it / mark as not used.
4. Submit for review.

Do **not** re-declare `mediaProjection` unless you restore Android Present, keep an ongoing share notification, and attach a demo of user-tapped Present → system capture prompt.
