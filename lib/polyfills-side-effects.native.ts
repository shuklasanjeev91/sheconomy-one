// TextDecoder/TextEncoder must exist before Supabase, LiveKit, or other deps load on Hermes.
import '@livekit/react-native/lib/commonjs/polyfills/EncoderDecoderTogether.min.js'
import '@azure/core-asynciterator-polyfill'
import 'core-js/actual/url'
import 'core-js/actual/url-search-params'

import { LogBox } from 'react-native'

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
import { registerGlobals } from '@livekit/react-native'

// Register Tamagui config on the single @tamagui/web instance before any UI mounts.
import '~/config/tamagui.config'

globalThis.global = globalThis
registerGlobals()
