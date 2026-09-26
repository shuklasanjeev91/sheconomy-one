# Play Console — declare mediaProjection (required)

Android Present needs `FOREGROUND_SERVICE_MEDIA_PROJECTION` only.
Virtual backgrounds are an in-app camera processor — **no** foreground service.

If this form is missing, stale, or lists extra types, Play rejects with:

- Permission use is either not declared or incorrectly declared
- Functionality is not initiated by or perceptible to the user
- Service interruption or deferment does not have material user impact

AAB version codes **198+** already ship **only** mediaProjection. The rejection is
almost always the Console declaration, not the binary.

## Critical: do this BEFORE “Send for review”

1. Open **Play Console → Monitor and improve → App content → Sensitive app permissions**  
   (or **Policy status → Permissions for Foreground Services**).
2. Edit the Foreground service permissions declaration.
3. Keep **only** `mediaProjection`.  
   Uncheck / remove phoneCall, microphone, camera, location, dataSync, specialUse, mediaPlayback, connectedDevice.
4. Upload a **demo video** (required). Without it, reviewers reject as “not perceptible / no material impact”.

### Exact answers

| Field | Answer |
|-------|--------|
| Foreground service type | **mediaProjection** only |
| Use case (pick from list) | **Media or Content Projection and streaming or recording with MediaProjection API** |
| Description | Co-Work live meetings: the host taps **Present** to share their Android screen with other participants via the system MediaProjection capture sheet. |
| How it starts | User taps **Present** in an active Co-Work meeting → Android system screen-capture consent → share starts |
| How the user sees it | Ongoing HIGH-importance notification: “Sharing your screen — SHEconomy Co-Work is sharing your screen in a live meeting.” Also an in-meeting “You’re sharing” status. |
| User impact if deferred/interrupted | Screen share stops for all participants; the meeting Present feature fails until the user starts Present again. Continuous capture is required for live collaboration. |
| Demo video (mandatory) | https://www.youtube.com/shorts/ccTdrLWhtDg |

## Release workflow (do not skip)

1. Upload the new AAB as a **draft** (internal or production).  
   EAS uses `changesNotSentForReview: true` so Google does **not** auto-review.
2. Complete / replace the mediaProjection declaration + video above.
3. In App bundle explorer, confirm **Target SDK = 36** and permissions show only `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION`.
4. Only then click **Send for review** / promote the release.

## Do not declare

phoneCall, microphone, camera, location, dataSync, specialUse, mediaPlayback, connectedDevice.
