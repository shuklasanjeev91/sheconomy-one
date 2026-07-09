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
