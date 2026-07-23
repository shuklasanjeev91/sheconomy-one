// TextDecoder/TextEncoder must exist before Supabase, LiveKit, or other deps load on Hermes.
// Deep LiveKit package subpaths are blocked by "exports"; load via absolute path helper.
import './livekit-encoder-polyfill.cjs'
import '@azure/core-asynciterator-polyfill'
// Hermes URL exposes `protocol` as a getter-only property. SupabaseClient does
// `realtimeUrl.protocol = ...` on construct and crashes → white screen after splash.
import 'react-native-url-polyfill/auto'
// Hermes may ship fetch without Headers. Side-effect import installs only missing
// fetch globals (see scripts/patch-whatwg-fetch.cjs) — avoid named imports which
// can interop as namespace objects under Metro ("Object is not a function").
import 'whatwg-fetch'

import { LogBox } from 'react-native'

/** RN's abort-controller polyfill lacks modern static helpers used by deps. */
function installAbortSignalHelpers() {
  const AbortSignalImpl = globalThis.AbortSignal as typeof AbortSignal | undefined
  if (!AbortSignalImpl) return

  if (typeof AbortSignalImpl.timeout !== 'function') {
    AbortSignalImpl.timeout = (ms: number) => {
      const controller = new AbortController()
      const id = setTimeout(() => {
        controller.abort(
          typeof DOMException === 'function'
            ? new DOMException('The operation was aborted due to timeout', 'TimeoutError')
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
import '~/config/tamagui.config'
import { startNativeBootstrapPrefetch } from '~/lib/bootstrap/app-prefetch'

globalThis.global = globalThis
startNativeBootstrapPrefetch()

// Do NOT call LiveKit `registerGlobals()` here. It starts WebRTC threads immediately
// and can race Hermes GC on cold start (SIGSEGV on the `hades` thread). Globals are
// registered lazily via `ensureLiveKitGlobals()` when entering a meeting room.
