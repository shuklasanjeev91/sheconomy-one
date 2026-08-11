import { useEffect, useState } from 'react'

import { BRAND_NAME } from '~/config/brand'
import { detectMobileDevice, isInAppBrowser } from '~/lib/utils/mobile-detection'
import {
  buildAndroidAutoIntentUrl,
  buildAndroidIntentUrl,
  buildOpenInAppSchemeUrl,
  getWebPathForApp,
} from '~/lib/platform/open-in-app'

const DISMISS_KEY = 'sheconomy.openInApp.dismissed'
const ATTEMPTED_KEY = 'sheconomy.openInApp.attempted'

/**
 * Mobile-web handoff for links the OS did not route into the app.
 *
 * Universal Links / App Links cover most taps, but they are skipped when the
 * URL is typed in the address bar, reached through a redirect, or opened inside
 * a messaging app's embedded browser. This host shows an explicit "Open in app"
 * control and makes one silent attempt where that attempt cannot backfire:
 *
 * - Android: a scheme-only `intent://` that no-ops when the app is missing.
 * - iOS: only inside a known in-app browser, where Universal Links never fire.
 *   In real Safari the scheme would raise "address is invalid" for visitors
 *   without the app, so the banner button stays the only trigger there.
 */
export function OpenInAppHost() {
  const [visible, setVisible] = useState(false)
  const device = detectMobileDevice()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!device.isMobile || (!device.isIOS && !device.isAndroid)) return

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // ignore storage failures
    }

    setVisible(true)

    const canAutoAttempt = device.isAndroid || isInAppBrowser()
    if (!canAutoAttempt) return

    try {
      if (window.sessionStorage.getItem(ATTEMPTED_KEY) === '1') return
      window.sessionStorage.setItem(ATTEMPTED_KEY, '1')
    } catch {
      // still attempt once this session
    }

    const timer = window.setTimeout(() => {
      const path = getWebPathForApp()
      window.location.href = device.isAndroid
        ? buildAndroidAutoIntentUrl(path)
        : buildOpenInAppSchemeUrl(path)
    }, 400)

    return () => window.clearTimeout(timer)
  }, [device.isAndroid, device.isIOS, device.isMobile])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        padding: '0 12px 12px',
        pointerEvents: 'none',
      }}
    >
      <div
        role="region"
        aria-label={`Open in ${BRAND_NAME}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#1a0a12',
          borderRadius: 14,
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Open in {BRAND_NAME}</div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 }}>
            Continue in the app for the full experience
          </div>
        </div>
        <button
          type="button"
          onClick={() => openNativeApp(device.isAndroid)}
          style={{
            background: '#D81B60',
            color: '#fff',
            border: 0,
            borderRadius: 999,
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Open
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              // ignore
            }
            setVisible(false)
          }}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            border: 0,
            fontSize: 16,
            cursor: 'pointer',
            padding: 6,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function openNativeApp(isAndroid: boolean) {
  if (typeof window === 'undefined') return
  const path = getWebPathForApp()
  const target = isAndroid ? buildAndroidIntentUrl(path) : buildOpenInAppSchemeUrl(path)
  window.location.href = target
}
