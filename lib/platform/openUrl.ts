import { Linking, Platform } from 'react-native'

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.href = url
      return true
    }
    return false
  }

  const canOpen = await Linking.canOpenURL(url)
  if (!canOpen) return false
  await Linking.openURL(url)
  return true
}
