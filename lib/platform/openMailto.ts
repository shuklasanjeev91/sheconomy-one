import { Platform, Linking } from 'react-native'

/** Open a mailto: link on web and native without unloading the SPA. */
export async function openMailtoLink(mailto: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const anchor = document.createElement('a')
    anchor.href = mailto
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }
  await Linking.openURL(mailto)
}
