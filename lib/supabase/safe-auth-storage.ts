import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_TIMEOUT_MS = 2_500

/**
 * Supabase auth storage that never hangs the JS thread waiting on AsyncStorage.
 * A hung getItem (seen on some iPadOS builds) blocks every RPC — including Add to Cart.
 */
const memory = new Map<string, string>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('auth-storage-timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export const safeAuthStorage = {
  async getItem(key: string) {
    if (memory.has(key)) return memory.get(key) ?? null
    try {
      const value = await withTimeout(AsyncStorage.getItem(key), STORAGE_TIMEOUT_MS)
      if (value != null) memory.set(key, value)
      return value
    } catch {
      return memory.get(key) ?? null
    }
  },
  async setItem(key: string, value: string) {
    memory.set(key, value)
    try {
      await withTimeout(AsyncStorage.setItem(key, value), STORAGE_TIMEOUT_MS)
    } catch {
      // Memory write is enough for the current session.
    }
  },
  async removeItem(key: string) {
    memory.delete(key)
    try {
      await withTimeout(AsyncStorage.removeItem(key), STORAGE_TIMEOUT_MS)
    } catch {
      // ignore
    }
  },
}
