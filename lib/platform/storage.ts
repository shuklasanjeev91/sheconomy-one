import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

export async function readSessionValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.sessionStorage.getItem(key)
    }
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

export async function writeSessionValue(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, value)
      return
    }
    await AsyncStorage.setItem(key, value)
  } catch {
    // ignore quota errors
  }
}

/** Sync read for initial state — web only; native returns null until async hydrate. */
export function readSessionValueSync(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  }
  return null
}
