// Hermes has no DOMException. WebRTC code subclasses it at module scope, so a
// cold start straight into /co-work/meeting/:code/live (universal link) evaluated it
// before any meeting-side guard could run. Keep this the first import in the bundle.
import '~/lib/polyfills/install-dom-exception'
import { installWebCryptoPolyfill } from '~/lib/polyfills/web-crypto'
// TextDecoder/TextEncoder must exist before Supabase or other deps load on Hermes.
import '~/lib/polyfills/text-encoding'
import '@azure/core-asynciterator-polyfill'
// Hermes URL exposes `protocol` as a getter-only property. SupabaseClient does
// `realtimeUrl.protocol = ...` on construct and crashes → white screen after splash.
import 'react-native-url-polyfill/auto'
// Hermes may ship fetch without Headers. Side-effect import installs only missing
// fetch globals (see scripts/patch-whatwg-fetch.cjs) — avoid named imports which
// can interop as namespace objects under Metro ("Object is not a function").
import 'whatwg-fetch'

import { LogBox } from 'react-native'

// react-native-webrtc pulls `debug`, whose Node entry does require('tty'). Hermes has no
// Node require — Rolldown then throws. Mark this as a browser-like process so
// `debug` selects its browser build instead.
if (typeof process !== 'undefined') {
  const proc = process as NodeJS.Process & { browser?: boolean }
  proc.browser = true
}


/** RN's abort-controller polyfill lacks modern static helpers used by deps. */
function installAbortSignalHelpers() {
  const AbortSignalImpl = globalThis.AbortSignal as typeof AbortSignal | undefined
  if (!AbortSignalImpl) return

  if (typeof AbortSignalImpl.timeout !== 'function') {
    AbortSignalImpl.timeout = (ms: number) => {
      const controller = new AbortController()
      const id = setTimeout(() => {
        controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      }, ms)
      controller.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(id)
        },
        { once: true },
      )
      return controller.signal
    }
  }

  if (typeof AbortSignalImpl.any !== 'function') {
    AbortSignalImpl.any = (signals: AbortSignal[]) => {
      const controller = new AbortController()
      const onAbort = (event: Event) => {
        const target = event.target as AbortSignal
        controller.abort(target.reason)
      }
      for (const signal of signals) {
        if (signal.aborted) {
          controller.abort(signal.reason)
          break
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }
      return controller.signal
    }
  }
}

installAbortSignalHelpers()
installWebCryptoPolyfill()

// Meeting media retries on its own while the room shows "Reconnecting…"; keep those
// recoverable errors out of the red LogBox overlay.
const MEETING_RECOVERABLE_ERRORS = /\[mediasoup\]|protoo|WebSocket closed|ICE failed/i
LogBox.ignoreLogs([MEETING_RECOVERABLE_ERRORS])

// LogBox.ignoreLogs alone is not enough in some Expo/OTA builds — console.error
// still becomes a red SyntheticError overlay that covers the live meeting.
const originalConsoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  const text = args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg && typeof arg === 'object' && 'message' in arg) {
        return String((arg as { message?: unknown }).message ?? '')
      }
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
  if (MEETING_RECOVERABLE_ERRORS.test(text)) {
    console.log('[meeting]', ...args)
    return
  }
  originalConsoleError(...(args as Parameters<typeof console.error>))
}

// Dev-only noise from react-native-svg + upstream RN deprecations (harmless on current stack).
if (__DEV__) {
  LogBox.ignoreLogs([
    /Codegen didn't run for RNSVG/,
    'findNodeHandle is deprecated',
    'SafeAreaView has been deprecated',
  ])
}

// Tamagui native integrations (order matters — target env first).
// Bracket/Object.assign avoids Babel inline-env turning the assignment LHS into a literal.
Object.assign(process.env, { TAMAGUI_TARGET: 'native' })
import 'react-native-gesture-handler'
import '@tamagui/native/setup-gesture-handler'
import '@tamagui/native/setup-safe-area'
import '@tamagui/native/setup-expo-linear-gradient'
import '@tamagui/native/setup-teleport'
import '@tamagui/native/setup-worklets'

// Register Tamagui config on the single @tamagui/web instance before any UI mounts.
import '~/config/tamagui.config.native'
import { warmCriticalAppCaches } from '~/lib/bootstrap/warm-app-cache'
import { startNativeBootstrapPrefetch } from '~/lib/bootstrap/app-prefetch'
import '~/lib/brand/register-suspense-fallback'

globalThis.global = globalThis
// Disk → memory before network prefetch so Home can paint from last session.
warmCriticalAppCaches()
startNativeBootstrapPrefetch()

// Do NOT call WebRTC `registerGlobals()` here. It starts WebRTC threads immediately
// and can race Hermes GC on cold start (SIGSEGV on the `hades` thread). Globals are
// registered lazily via `ensureWebRTCGlobals()` when entering a meeting room.