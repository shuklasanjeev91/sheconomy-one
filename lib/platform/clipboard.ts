import { Platform, Share } from 'react-native'

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }

    await Share.share({ message: text })
    return true
  } catch {
    return false
  }
}
