import { Platform } from 'react-native'
import createWebStorage from 'redux-persist/es/storage/createWebStorage'
import type { WebStorage } from 'redux-persist/es/types'

/**
 * SSR-safe no-op storage. `createWebStorage` already returns this shape when
 * `window` is unavailable, but we keep an explicit fallback for native SSR too.
 */
function createNoopStorage(): WebStorage {
  return {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  }
}

/**
 * Cross-platform redux-persist storage:
 * - web  -> localStorage (via redux-persist web storage; noop during SSR)
 * - native -> AsyncStorage
 */
function resolveStorage(): WebStorage {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? createWebStorage('local') : createNoopStorage()
  }

  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default as WebStorage
  return AsyncStorage
}

export const persistStorage = resolveStorage()
