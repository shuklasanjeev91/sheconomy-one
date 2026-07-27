/** Web stub for `expo-camera` — real native module is used on iOS/Android. */

import { useCallback, useState } from 'react'

type PermissionResponse = {
  granted: boolean
  canAskAgain?: boolean
  status?: 'undetermined' | 'granted' | 'denied'
}

export const CameraView = () => null

export const Camera = {
  async requestCameraPermissionsAsync() {
    return { granted: false, canAskAgain: true, status: 'undetermined' as const }
  },
  async requestMicrophonePermissionsAsync() {
    return { granted: false, canAskAgain: true, status: 'undetermined' as const }
  },
}

/**
 * Mirror expo-camera's hook shape synchronously — the previous async stub broke
 * `const [permission, request] = useCameraPermissions()` on web (Promise is not iterable).
 */
export function useCameraPermissions(): [
  PermissionResponse | null,
  () => Promise<PermissionResponse>,
] {
  const [permission] = useState<PermissionResponse | null>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  })
  const requestPermission = useCallback(async () => ({ granted: false }), [])
  return [permission, requestPermission]
}

export default { Camera, CameraView, useCameraPermissions }
