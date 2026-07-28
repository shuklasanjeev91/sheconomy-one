/** Shared path for the OneSignal + PWA service worker (scope `/`). */
export const PWA_SERVICE_WORKER_URL = '/OneSignalSDKWorker.js'

export const PWA_MANIFEST_URL = '/manifest.webmanifest'

export function canUseServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

/** Register (or reuse) the root-scope SW required for installability + web push. */
export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null

  const existing = await navigator.serviceWorker.getRegistrations()
  const already = existing.find((reg) => {
    const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
    return url.includes('OneSignalSDKWorker') || url.endsWith(PWA_SERVICE_WORKER_URL)
  })
  if (already) {
    await navigator.serviceWorker.ready
    return already
  }

  const registration = await navigator.serviceWorker.register(PWA_SERVICE_WORKER_URL, {
    scope: '/',
    updateViaCache: 'none',
  })
  await navigator.serviceWorker.ready
  return registration
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return Boolean(media || iosStandalone)
}
