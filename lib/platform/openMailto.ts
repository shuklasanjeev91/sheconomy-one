import { Platform, Linking } from 'react-native'

/** Open a mailto: link on web and native. */
export async function openMailtoLink(mailto: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(mailto, '_blank')
    return
  }
  await Linking.openURL(mailto)
}
