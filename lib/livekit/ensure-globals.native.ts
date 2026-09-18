// Keep first: `@livekit/react-native` pulls WebRTC code that extends DOMException.
import '~/lib/polyfills/install-dom-exception'

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

  // `debug` (via WebRTC) probes process on load; prefer its browser build over
  // the Node entry, which does require('tty') and throws under Hermes.
  if (typeof process !== 'undefined') {
    ;(process as NodeJS.Process & { browser?: boolean }).browser = true
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native')
  registerGlobals()

  // Must run after livekit-client is loadable — silences screen-share LogBox.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { patchLiveKitWaitForDimensions } = require('~/co-work/lib/livekit-patch-dimensions') as typeof import('~/co-work/lib/livekit-patch-dimensions')
  patchLiveKitWaitForDimensions()
}
