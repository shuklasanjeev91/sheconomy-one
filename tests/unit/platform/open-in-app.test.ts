import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ANDROID_PACKAGE_ID,
  buildAndroidAutoIntentUrl,
  buildAndroidIntentUrl,
  buildOpenInAppSchemeUrl,
  buildSmartAppBannerContent,
  launchNativeApp,
  readAppInstalledHint,
} from '~/lib/platform/open-in-app'

describe('open-in-app helpers', () => {
  it('builds custom scheme URLs', () => {
    expect(buildOpenInAppSchemeUrl('/listing/bag')).toBe('sheconomy://listing/bag')
    expect(buildOpenInAppSchemeUrl('orders/1')).toBe('sheconomy://orders/1')
  })

  it('builds Android intent URLs', () => {
    const url = buildAndroidIntentUrl('/shop/foo')
    expect(url).toContain('intent://shop/foo#Intent;')
    expect(url).toContain(`scheme=sheconomy`)
    expect(url).toContain(`package=${ANDROID_PACKAGE_ID}`)
  })

  it('keeps the automatic Android intent free of Play Store fallback', () => {
    const url = buildAndroidAutoIntentUrl('/co-work/meeting/961-O0F-8NS/live')
    expect(url).toBe('intent://co-work/meeting/961-O0F-8NS/live#Intent;scheme=sheconomy;end')
    expect(url).not.toContain('package=')
    expect(url).not.toContain('browser_fallback_url')
  })

  it('builds Smart App Banner content', () => {
    expect(buildSmartAppBannerContent('/community')).toContain('app-id=6499198194')
    expect(buildSmartAppBannerContent('/community')).toContain('app-argument=/community')
  })
})

describe('launchNativeApp', () => {
  function fakeBrowser() {
    const store = new Map<string, string>()
    const docListeners = new Map<string, () => void>()
    const winListeners = new Map<string, () => void>()
    const appended: { src?: string }[] = []
    const doc = {
      visibilityState: 'visible',
      body: {
        appendChild: (node: { src?: string }) => {
          appended.push(node)
          return node
        },
      },
      createElement: (tag: string) => {
        if (tag !== 'iframe') throw new Error(`unexpected element ${tag}`)
        return {
          style: { display: '' },
          setAttribute: () => undefined,
          src: '',
          remove: () => undefined,
        }
      },
      addEventListener: (type: string, fn: () => void) => docListeners.set(type, fn),
      removeEventListener: (type: string) => docListeners.delete(type),
    }
    const win = {
      location: { href: '', pathname: '/', search: '' },
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
      open: vi.fn(() => null),
      addEventListener: (type: string, fn: () => void) => winListeners.set(type, fn),
      removeEventListener: (type: string) => winListeners.delete(type),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    }
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', doc)
    return { win, doc, docListeners, appended }
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('hands off via a hidden iframe without assigning window.location', () => {
    const { win, doc, docListeners, appended } = fakeBrowser()
    const onResult = vi.fn()
    expect(readAppInstalledHint()).toBeNull()
    launchNativeApp('sheconomy://co-work/meeting/ABC', { onResult })
    expect(win.location.href).toBe('')
    expect(appended[0]?.src).toBe('sheconomy://co-work/meeting/ABC')
    doc.visibilityState = 'hidden'
    docListeners.get('visibilitychange')?.()
    expect(onResult).toHaveBeenCalledWith(true)
    expect(readAppInstalledHint()).toBe(true)
  })

  it('forgets the app only after an automatic attempt goes nowhere', () => {
    vi.useFakeTimers()
    fakeBrowser()
    const onResult = vi.fn()
    launchNativeApp('sheconomy://x', { onResult })
    vi.advanceTimersByTime(6000)
    expect(onResult).toHaveBeenCalledWith(false)
    expect(readAppInstalledHint()).toBeNull()

    launchNativeApp('sheconomy://x', { automatic: true })
    vi.advanceTimersByTime(6000)
    expect(readAppInstalledHint()).toBe(false)
  })
})
