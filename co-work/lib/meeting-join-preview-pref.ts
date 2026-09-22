/**
 * Persist Zoom-style "Always show this preview when joining" preference.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const STORAGE_KEY = 'sheconomy.meeting.alwaysShowJoinPreview.v1'

function webStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export async function loadAlwaysShowJoinPreview(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const store = webStorage()
      const raw = store?.getItem(STORAGE_KEY)
      if (raw === '0' || raw === 'false') return false
      return true
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

export async function saveAlwaysShowJoinPreview(value: boolean): Promise<void> {
  const encoded = value ? '1' : '0'
  try {
    if (Platform.OS === 'web') {
      webStorage()?.setItem(STORAGE_KEY, encoded)
      return
    }
    await AsyncStorage.setItem(STORAGE_KEY, encoded)
  } catch {
    // Private mode / quota — preference is best-effort.
  }
}
