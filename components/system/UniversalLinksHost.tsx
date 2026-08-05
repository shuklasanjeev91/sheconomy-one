import { useEffect, useRef } from 'react'
import { Linking, Platform } from 'react-native'

import { openAppPath, pathFromIncomingUrl } from '~/lib/platform/linking'

/**
 * Opens https://sheconomy.in / www / sheconomy:// links in the native app
 * when the OS hands them off (Universal Links / App Links / custom scheme).
 *
 * One Router also receives linking prefixes; this host covers cold start and
 * warm resume when the SPA navigator is already mounted.
 */
export function UniversalLinksHost() {
  const lastHandledRef = useRef<string | null>(null)

  useEffect(() => {
    if (Platform.OS === 'web') return

    const handleUrl = (url: string | null) => {
      if (!url) return
      if (lastHandledRef.current === url) return
      const path = pathFromIncomingUrl(url)
      if (!path) return
      lastHandledRef.current = url
      void openAppPath(path)
    }

    void Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  return null
}
