/**
 * LiveKit WebRTC globals are heavy — only register when entering a meeting.
 * Called from co-work screens, not from the root polyfill bundle.
 */
let registered = false

export function ensureLiveKitNativeGlobals(): void {
  if (registered || typeof globalThis === 'undefined') return

  // `debug` (via WebRTC) may probe process before registerGlobals; prefer browser build.
  if (typeof process !== 'undefined') {
    ;(process as NodeJS.Process & { browser?: boolean }).browser = true
  }

  // Safety net if meeting opens before root polyfills finished evaluating.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { installDOMExceptionPolyfill } = require('~/lib/polyfills/dom-exception') as {
      installDOMExceptionPolyfill: () => void
    }
    installDOMExceptionPolyfill()
  } catch {
    // ignore
  }

  registered = true

  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native')
  registerGlobals()
}
