import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('pwa register helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('reports service worker support from navigator', async () => {
    vi.stubGlobal('navigator', {})
    const { canUseServiceWorker } = await import('~/lib/pwa/register')
    expect(canUseServiceWorker()).toBe(false)

    vi.stubGlobal('navigator', { serviceWorker: {} })
    const again = await import('~/lib/pwa/register')
    expect(again.canUseServiceWorker()).toBe(true)
  })

  it('registers the shared OneSignal + PWA worker once', async () => {
    const register = vi.fn().mockResolvedValue({ scope: '/' })
    const ready = Promise.resolve({})
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([]),
        register,
        ready,
      },
    })

    const { registerPwaServiceWorker, PWA_SERVICE_WORKER_URL } = await import('~/lib/pwa/register')
    await registerPwaServiceWorker()
    expect(register).toHaveBeenCalledWith(PWA_SERVICE_WORKER_URL, {
      scope: '/',
      updateViaCache: 'none',
    })
  })

  it('reuses an existing OneSignal worker registration', async () => {
    const existing = {
      active: { scriptURL: 'https://example.com/OneSignalSDKWorker.js' },
    }
    const register = vi.fn()
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([existing]),
        register,
        ready: Promise.resolve({}),
      },
    })

    const { registerPwaServiceWorker } = await import('~/lib/pwa/register')
    const result = await registerPwaServiceWorker()
    expect(result).toBe(existing)
    expect(register).not.toHaveBeenCalled()
  })
})
