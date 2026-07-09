export const CameraView = () => null

export async function useCameraPermissions() {
  return [{ granted: false }, async () => ({ granted: false })] as const
}
