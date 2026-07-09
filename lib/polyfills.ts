import { Platform } from 'react-native'

/**
 * Shared polyfill entry — loaded on native via One setupFile and via setup-polyfill
 * before Supabase. Web builds skip this block at bundle time.
 */
if (Platform.OS !== 'web') {
  globalThis.global = globalThis

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@azure/core-asynciterator-polyfill')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('core-js/actual/url')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('core-js/actual/url-search-params')

  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native')
  registerGlobals()
}
