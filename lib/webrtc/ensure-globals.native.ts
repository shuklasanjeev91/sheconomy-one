// Keep first: react-native-webrtc extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

let registered = false

/**
 * WebRTC globals (`RTCPeerConnection`, `navigator.mediaDevices`, …). Call before
 * joining a room — not at app cold start. Eager `registerGlobals()` spins WebRTC
 * worker threads that can race Hermes GC (`hades`) on iOS Simulator and crash
 * with EXC_BAD_ACCESS.
 *
 * Uses require() inside the function so importing this helper does not load
 * WebRTC until a meeting actually starts.
 */
export function ensureWebRTCGlobals() {
  if (registered) return
  registered = true

  // `debug` (via WebRTC) probes process on load; prefer its browser build over
  // the Node entry, which does require('tty') and throws under Hermes.
  if (typeof process !== 'undefined') {
    ;(process as NodeJS.Process & { browser?: boolean }).browser = true
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerGlobals } = require('react-native-webrtc') as typeof import('react-native-webrtc')
  registerGlobals()
}
