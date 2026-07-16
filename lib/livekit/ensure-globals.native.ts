let registered = false

/**
 * LiveKit/WebRTC globals. Call before joining a room — not at app cold start.
 * Eager `registerGlobals()` spins WebRTC worker threads that can race Hermes GC
 * (`hades`) on iOS Simulator and crash with EXC_BAD_ACCESS.
 *
 * Uses require() inside the function so importing this helper does not load
 * `@livekit/react-native` / WebRTC until a meeting actually starts.
 */
export function ensureLiveKitGlobals() {
  if (registered) return
  registered = true
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native')
  registerGlobals()
}
