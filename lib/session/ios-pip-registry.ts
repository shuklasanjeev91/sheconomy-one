/**
 * Holds a ref to the primary native video view for manual iOS Picture-in-Picture.
 */

type PipRef = { current: unknown }

let primaryPipRef: PipRef | null = null

export function registerIosPipVideoRef(ref: PipRef | null): void {
  primaryPipRef = ref
}

export function getIosPipVideoRef(): PipRef | null {
  return primaryPipRef
}

export async function startRegisteredIosPip(): Promise<void> {
  if (!primaryPipRef?.current) {
    throw new Error(
      'No active video for Picture-in-Picture yet. Keep the meeting open with someone’s camera on, then try again.',
    )
  }
  // Dynamic import keeps web/Android bundles free of the native module.
  const { startIOSPIP } = require('@livekit/react-native-webrtc') as {
    startIOSPIP: (ref: PipRef) => void
  }
  startIOSPIP(primaryPipRef)
}

export async function stopRegisteredIosPip(): Promise<void> {
  if (!primaryPipRef?.current) return
  try {
    const { stopIOSPIP } = require('@livekit/react-native-webrtc') as {
      stopIOSPIP: (ref: PipRef) => void
    }
    stopIOSPIP(primaryPipRef)
  } catch {
    // Best-effort.
  }
}
