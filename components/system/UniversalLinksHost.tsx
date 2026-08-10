import { useEffect, useRef } from 'react'
import { Linking, Platform } from 'react-native'
import { usePathname } from 'one'

import { openAppPath, pathFromIncomingUrl } from '~/lib/platform/linking'

/** Grace period for One's own linking listener to route the URL first. */
const HANDOFF_GRACE_MS = 350

function normalizePath(value: string): string {
  const [path = '/'] = value.split('?')
  return path.replace(/\/+$/, '') || '/'
}

/**
 * Safety net for https://www.sheconomy.in / https://sheconomy.in / sheconomy://
 * links that the OS hands to the app (Universal Links, App Links, custom
 * scheme).
 *
 * One Router already receives the same prefixes and routes both the launch URL
 * and warm `url` events, so this host waits a moment and only navigates when
 * the router did not land on the incoming path — otherwise every deep link
 * would push the destination screen twice.
 */
export function UniversalLinksHost() {
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (Platform.OS === 'web') return

    let disposed = false
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let lastHandled: string | null = null

    const handleUrl = (url: string | null) => {
      if (!url || disposed || lastHandled === url) return
      lastHandled = url

      const path = pathFromIncomingUrl(url)
      if (!path) return

      const timer = setTimeout(() => {
        timers.delete(timer)
        if (disposed) return
        if (normalizePath(path) === normalizePath(pathnameRef.current ?? '/')) return
        void openAppPath(path)
      }, HANDOFF_GRACE_MS)
      timers.add(timer)
    }

    void Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))

    return () => {
      disposed = true
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      sub.remove()
    }
  }, [])

  return null
}
