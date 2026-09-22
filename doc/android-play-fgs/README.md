# Google Play — Foreground Services + Target API 36

Play previously rejected unused FGS types (`phoneCall`, `microphone`). Android
**Present** needs **mediaProjection** only: the user taps Present, Android shows
the system screen-capture prompt, and an ongoing notification stays visible
while sharing.

Target SDK is **36**.

| Platform | Calls | Screen share (Present) |
|----------|-------|------------------------|
| Android | In-app overlay + push (no CallKeep FGS) | MediaProjection FGS (user-initiated) |
| iOS | CallKit | Broadcast Extension |
| Web | In-app | Browser screen share |

## Engineering checklist (in repo)

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, `compileSdkVersion` **36**
  - LiveKit / expo-livekit-screen-share Android screen-share flags **true**
  - Do **not** declare phoneCall / microphone / camera / location FGS
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — **iOS only**
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin:
  - `tools:node=remove` for CallKeep + location FGS
  - Keep `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`
  - `ENABLE_SCREEN_SHARE_SERVICE=true`
- Verify: `yarn verify:android-fgs`

## Play Console steps

1. Upload production AAB with `versionCode` **182+**.
2. App bundle explorer: confirm **Target SDK = 36**.
3. Foreground service permissions: declare **mediaProjection** only.
   - Use: video / screen sharing in Co-Work meetings
   - Started by the user tapping Present
   - System MediaProjection consent + ongoing Present notification
4. Do **not** declare phoneCall, microphone, camera, or location FGS.
5. Submit for review.

OTA cannot add MediaProjection to older Play binaries — users on those builds
must install this native update.
