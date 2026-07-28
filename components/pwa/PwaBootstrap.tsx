import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { isStandaloneDisplayMode, registerPwaServiceWorker } from '~/lib/pwa/register'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Registers the PWA service worker early on web and captures the browser
 * install prompt so Settings / chrome can offer “Install app”.
 */
export function PwaBootstrap() {
  const [, bump] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    void registerPwaServiceWorker().catch((error) => {
      console.warn('[pwa] service worker registration failed', error)
    })

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      deferredPrompt = event as BeforeInstallPromptEvent
      emit()
      bump((n) => n + 1)
    }

    const onInstalled = () => {
      deferredPrompt = null
      emit()
      bump((n) => n + 1)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return null
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web') return

    const sync = () => {
      setIsInstalled(isStandaloneDisplayMode())
      setCanInstall(Boolean(deferredPrompt) && !isStandaloneDisplayMode())
    }
    sync()
    return subscribe(sync)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    const prompt = deferredPrompt
    deferredPrompt = null
    emit()
    await prompt.prompt()
    const choice = await prompt.userChoice
    return choice.outcome === 'accepted'
  }, [])

  return {
    canInstall: Platform.OS === 'web' && canInstall,
    isInstalled: Platform.OS === 'web' && isInstalled,
    promptInstall,
  }
}
