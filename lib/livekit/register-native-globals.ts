/**
 * LiveKit WebRTC globals are heavy — only register when entering a meeting.
 * Called from co-work screens, not from the root polyfill bundle.
 */
let registered = false

export function ensureLiveKitNativeGlobals(): void {
  if (registered || typeof globalThis === 'undefined') return
  registered = true

  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native')
  registerGlobals()
}
