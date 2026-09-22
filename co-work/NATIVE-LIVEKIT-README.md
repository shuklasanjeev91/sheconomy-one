# Native LiveKit & Screen Share — Setup & Test

This document explains how to verify and build the native LiveKit integration and mobile screen-sharing features for the Co-Work (meeting) module.

## Summary
- Project already includes native entrypoints and Expo plugin configuration for LiveKit and screen-share.
- Key files:
  - `co-work/components/NativeLiveKitMeetingRoom.tsx`
  - `co-work/components/LiveKitMeetingRoom.native-entry.tsx`
  - `co-work/hooks/useLiveKitMediaControls.native.tsx`
  - `app.json` (Expo plugin entries for `@livekit/react-native-expo-plugin` and `expo-livekit-screen-share`)

## Quick checks
1. Confirm these dependencies are in `package.json`: `@livekit/react-native`, `@livekit/react-native-expo-plugin`, `@livekit/react-native-webrtc`, `expo-livekit-screen-share`, `livekit-client`.
2. Confirm `app.json` contains the `@livekit/react-native-expo-plugin` and `expo-livekit-screen-share` plugin entries (already present).

## Local dev (recommended)
1. Install dependencies:
```bash
yarn install
```
2. Prebuild native projects (Expo / One prebuild):
```bash
yarn prebuild:native
```
3. iOS (physical device required for screen-share broadcast):
```bash
yarn ios
```
Notes: After the app launches on a device, start a meeting and tap the screen-share control. On iOS you'll be prompted by the ReplayKit broadcast picker — select the SHEconomy broadcast target and tap "Start Broadcast".

4. Android (MediaProjection):
```bash
yarn android
```
Notes: On Android you must grant the projection permission when prompted. The Expo plugin config enables a foreground screen-share service when `enableScreenShareService` is set in `app.json`.

## EAS / CI builds
- Use `eas build` to create production or preview builds that include app extensions and native plugins.
- Example:
```bash
eas build -p ios --profile development
eas build -p android --profile development
```

## iOS-specific notes
- `RTCScreenSharingExtension` and `RTCAppGroupIdentifier` are set in `app.json` `ios.infoPlist` for the screen-share extension.
- Screen sharing requires a physical device and the broadcast extension to be present in the built IPA.
- If you get "Screen share picker not ready" errors, ensure the `ScreenCapturePickerView` is mounted in the meeting tree (`co-work/hooks/useLiveKitMediaControls.native.tsx` mounts it) and the app has the extension target included in the build.

## Android-specific notes
- Minimum SDK is configured in `app.json` via `expo-build-properties`.
- MediaProjection consent must be accepted by the user. For background capture the `expo-livekit-screen-share` plugin will add a foreground service when enabled.
- If `androidPresentUnavailable()` returns true on a device, ensure the build includes the MediaProjection helper and the device supports it.

## Testing checklist
- [ ] Launch app on a physical iOS device; start a meeting; start and stop screen share successfully.
- [ ] Launch app on a physical Android device; start a meeting; start and stop screen share successfully.
- [ ] Verify audio/video publish and remote subscribe flows work after enabling/disabling screen share.
- [ ] Validate that broadcast extension (iOS) appears in Control Center broadcast targets.
- [ ] Validate that screen-share stream appears as a `Track.Source.ScreenShare` in room tracks and that UI switches to `screen-share` view mode.

## Troubleshooting
- If LiveKit tokens fail, check the edge function / backend that provides `fetchLiveKitCredentials`.
- On iOS, if the broadcast picker manager is missing at runtime, rebuild the app (the native module is injected by the Expo plugin during prebuild/EAS build).
- On Android, check logcat for MediaProjection errors and ensure the foreground service permission was included.

## Next actions I can take for you
- Run or create a CI script to produce test builds for iOS and Android (requires environment access).
- Add a small device testing checklist as an automated script (shell + adb / ios-deploy) to run smoke checks after a build.
- Implement any missing native hooks if you encounter runtime errors; point me at logs and I'll patch code.

If you want, I can add a PR with a simple test harness that opens a meeting and toggles screen share programmatically (device required to validate). Which next action do you want me to take?
