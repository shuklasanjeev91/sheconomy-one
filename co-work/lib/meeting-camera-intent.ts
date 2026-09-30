/**
 * Last known camera intent for the live meeting.
 * Permission sheets on Android briefly background the app before the SFU
 * reports cameraEnabled=true — lifecycle must not treat that as "user wanted off".
 */

let intendedCameraOn = false

export function setMeetingCameraIntent(enabled: boolean): void {
  intendedCameraOn = !!enabled
}

export function getMeetingCameraIntent(): boolean {
  return intendedCameraOn
}

export function syncMeetingCameraIntentFromTrack(enabled: boolean): void {
  intendedCameraOn = !!enabled
}
