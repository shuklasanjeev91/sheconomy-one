// TextDecoder/TextEncoder must exist before Supabase, LiveKit, or other deps load on Hermes.
// Deep LiveKit package subpaths are blocked by "exports"; load via absolute path helper.
import { installDOMExceptionPolyfill } from '~/lib/polyfills/dom-exception'

// Must run before LiveKit / WebRTC — bare `DOMException` refs throw on Hermes.
installDOMExceptionPolyfill()

import '~/lib/livekit-encoder-polyfill.cjs'
import '@azure/core-asynciterator-polyfill'
// Hermes URL exposes `protocol` as a getter-only property. SupabaseClient does
// `realtimeUrl.protocol = ...` on construct and crashes → white screen after splash.
import 'react-native-url-polyfill/auto'
// Hermes may ship fetch without Headers. Side-effect import installs only missing
// fetch globals (see scripts/patch-whatwg-fetch.cjs) — avoid named imports which
// can interop as namespace objects under Metro ("Object is not a function").
import 'whatwg-fetch'

import { LogBox } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'

// Keep the native splash briefly until NativeAppOnboardingGate paints, then
// force-hide so brand magenta never sticks as a blank unwanted screen.
void SplashScreen.preventAutoHideAsync().catch(() => {})
setTimeout(() => {
  void SplashScreen.hideAsync().catch(() => {})
}, 2500)

// LiveKit WebRTC pulls `debug`, whose Node entry does require('tty'). Hermes has no
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
        const DOMExceptionImpl = (globalThis as typeof globalThis & {
          DOMException?: typeof DOMException
        }).DOMException
        controller.abort(
          typeof DOMExceptionImpl === 'function'
            ? new DOMExceptionImpl('The operation was aborted due to timeout', 'TimeoutError')
            : undefined,
        )
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
// Native must use the RN animations config — web CSS animations crash Hermes.
import '~/config/tamagui.config.native'
import { startNativeBootstrapPrefetch } from '~/lib/bootstrap/app-prefetch'
import '~/lib/brand/register-suspense-fallback'

globalThis.global = globalThis
startNativeBootstrapPrefetch()

// Do NOT call LiveKit `registerGlobals()` here. It starts WebRTC threads immediately
// and can race Hermes GC on cold start (SIGSEGV on the `hades` thread). Globals are
// registered lazily via `ensureLiveKitGlobals()` when entering a meeting room.
