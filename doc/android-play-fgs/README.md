# Google Play — Foreground Services + Target API 35

Use this package when resubmitting after Policy status rejections for **Permissions for Foreground Services** and **Target API level (Android 15 / API 35)**.

## What the app uses FGS for

| Type | Permission | When it runs | User-visible signal |
|------|------------|--------------|---------------------|
| `phoneCall` + `microphone` | `FOREGROUND_SERVICE_PHONE_CALL`, `FOREGROUND_SERVICE_MICROPHONE` | Incoming/outgoing SHEconomy voice or video call via CallKeep ConnectionService | Ongoing notification: **“SHEconomy call in progress”** |
| `mediaProjection` | `FOREGROUND_SERVICE_MEDIA_PROJECTION` | User taps **Share screen** in a co-work meeting | Ongoing notification: **“Screen sharing”** / “You are currently sharing your screen.” |

We do **not** use:

- `FOREGROUND_SERVICE_CAMERA` / `camera` FGS type (camera for meetings runs in the activity; CallKeep FGS is mic + phoneCall only)
- `FOREGROUND_SERVICE_LOCATION` / location FGS (background location is disabled; LocationTaskService is stripped from the merged manifest)

## Play Console — Foreground service declarations

Declare only the types above. Suggested answers:

### phoneCall / microphone

- **Why needed:** Keep the VoIP / LiveKit meeting audio session alive when the user leaves the app or locks the screen during an active call.
- **User initiation:** User places a call or answers an incoming call (system incoming-call UI / in-app overlay).
- **Impact if delayed/stopped:** Call audio drops; participants cannot continue the conversation.
- **How users notice it:** Persistent “SHEconomy call in progress” notification; tapping returns to the call.

### mediaProjection

- **Why needed:** Capture and stream the device screen during a meeting after the user grants the system MediaProjection consent dialog.
- **User initiation:** User taps **Share screen** in the meeting controls.
- **Impact if delayed/stopped:** Screen share stops for other participants.
- **How users notice it:** Persistent “Screen sharing” notification until they stop sharing.

## Demo video checklist (30–60 seconds)

Record on a physical Android device (API 34+ preferred):

1. Open SHEconomy → start or join a **voice/video meeting / 1:1 call**.
2. Press Home so the app backgrounds — show the **call-in-progress** notification in the shade.
3. Return to the app → **end the call** → confirm the notification clears.
4. Join a meeting → tap **Share screen** → accept the system dialog.
5. Background the app — show the **Screen sharing** notification.
6. Return → stop sharing → confirm the notification clears.

Upload that video in the Play Console FGS declaration form.

## Store listing / Data safety notes

Mention in the public description (or “About this app”) that SHEconomy supports **voice/video meetings** and optional **screen sharing**, and that Android shows an ongoing notification while a call or screen share is active.

## Engineering checklist (already in repo)

- [`app.json`](../../app.json) — `expo-build-properties` `compileSdkVersion` / `targetSdkVersion` **35**; `versionCode` bumped for resubmit
- [`plugins/withCallKeep.cjs`](../../plugins/withCallKeep.cjs) — `foregroundServiceType=microphone|phoneCall` (no camera)
- [`plugins/withAndroidFgsCompliance.cjs`](../../plugins/withAndroidFgsCompliance.cjs) — strips unused location FGS; re-asserts CallKeep types
- Postinstall patches — visible CallKeep + MediaProjection notifications
- Verify: `yarn verify:android-fgs`

## Resubmit steps

1. `yarn install` (applies FGS notification patches)
2. `yarn verify:android-fgs`
3. Build production AAB (`eas build -p android --profile production`)
4. In Play Console → App bundle explorer: confirm **Target SDK = 35**
5. Complete FGS declarations + upload demo video
6. Submit the new version (`versionCode` ≥ 112)

Do not resubmit until declarations, video, and AAB targetSdk all match.
