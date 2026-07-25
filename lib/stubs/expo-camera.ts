/** Web stub for `expo-camera` — real native module is used on iOS/Android. */

export const CameraView = () => null

export const Camera = {
  async requestCameraPermissionsAsync() {
    return { granted: false, canAskAgain: true, status: 'undetermined' as const }
  },
  async requestMicrophonePermissionsAsync() {
    return { granted: false, canAskAgain: true, status: 'undetermined' as const }
  },
}

export async function useCameraPermissions() {
  return [{ granted: false }, async () => ({ granted: false })] as const
}

export default { Camera, CameraView, useCameraPermissions }
