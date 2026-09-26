# Google Play — MediaProjection Present + Target API 36

Android **Present** needs **mediaProjection** only: the user taps Present,
confirms the system screen-capture sheet, then an ongoing HIGH-importance
notification stays visible while sharing.

Virtual backgrounds use an in-app camera processor — **no** foreground service.

Target SDK is **36**.

Inspected production AAB **198**: only `FOREGROUND_SERVICE` +
`FOREGROUND_SERVICE_MEDIA_PROJECTION` + `MediaProjectionService`. Rejections with
those three FGS policy lines mean the **Play Console declaration** (or missing
demo video) is wrong — not that Present/VB need to be removed.

| Platform | Calls | Screen share (Present) | Virtual background |
|----------|-------|------------------------|--------------------|
| Android | In-app overlay + push (no CallKeep FGS) | MediaProjection FGS (user-initiated) | Frame processor |
| iOS | CallKit | Broadcast Extension | Frame processor |
| Web | In-app | Browser screen share | Web processor |

## Engineering checklist

- [`app.json`](../../app.json) — `targetSdkVersion` **36**, screen-share Android flags **true**
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — last plugin; strips unused FGS + WorkManager FGS; keeps MediaProjection
- [`eas.json`](../../eas.json) — Android submit uses `releaseStatus: draft` + `changesNotSentForReview: true`
- Verify: `yarn verify:android-fgs`
- **Required Console steps (do before Send for review):** [PLAY_CONSOLE_DECLARATION.md](./PLAY_CONSOLE_DECLARATION.md)

## Do not declare

phoneCall, microphone, camera, location, dataSync, specialUse, mediaPlayback, connectedDevice.
