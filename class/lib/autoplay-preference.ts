import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'class.autoplay_next'
const DEFAULT_AUTOPLAY = true

let cached: boolean | null = null
const listeners = new Set<(value: boolean) => void>()

export function getClassAutoplaySync(): boolean {
  return cached ?? DEFAULT_AUTOPLAY
}

export async function loadClassAutoplay(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw === '0' || raw === 'false') {
      cached = false
      return false
    }
    if (raw === '1' || raw === 'true') {
      cached = true
      return true
    }
  } catch {
    // ignore
  }
  cached = DEFAULT_AUTOPLAY
  return DEFAULT_AUTOPLAY
}

export async function setClassAutoplay(enabled: boolean): Promise<void> {
  cached = enabled
  listeners.forEach((listener) => listener(enabled))
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

export function subscribeClassAutoplay(listener: (value: boolean) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
