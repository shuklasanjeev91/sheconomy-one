import { Platform, Share } from 'react-native'

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }

    if (Platform.OS !== 'web') {
      const Clipboard = await import('expo-clipboard')
      await Clipboard.setStringAsync(text)
      return true
    }

    await Share.share({ message: text })
    return true
  } catch {
    try {
      await Share.share({ message: text })
      return true
    } catch {
      return false
    }
  }
}

/** Read clipboard text on web + native (expo-clipboard). */
export async function readFromClipboard(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText()
      return text?.trim() ? text.trim() : null
    }

    const Clipboard = await import('expo-clipboard')
    const text = await Clipboard.getStringAsync()
    return text?.trim() ? text.trim() : null
  } catch {
    return null
  }
}
