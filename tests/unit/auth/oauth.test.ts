import { beforeEach, describe, expect, it, vi } from 'vitest'

const { platform, exchangeCodeForSession, getSession } = vi.hoisted(() => ({
  platform: { OS: 'ios' as string },
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('react-native', () => ({ Platform: platform }))
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}))
vi.mock('~/features/auth/services/native-google', () => ({
  tryNativeGoogleSignIn: vi.fn(async () => ({ handled: false, error: null })),
}))
vi.mock('~/lib/supabase/client', () => ({
  supabase: { auth: { exchangeCodeForSession, getSession } },
}))

import {
  completeStrayOAuthRedirect,
  exchangeOAuthUrlForSession,
  resolveOAuthRedirectUrl,
} from '~/features/auth/services/oauth'

function stubWindow(href: string, storage: Record<string, string> = {}) {
  const url = new URL(href)
  const keys = Object.keys(storage)
  const replaceState = vi.fn()
  vi.stubGlobal('window', {
    location: { href, origin: url.origin, pathname: url.pathname, search: url.search },
    localStorage: {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => storage[k] ?? null,
    },
    history: { state: null, replaceState },
  })
  return replaceState
}

describe('OAuth redirect + code exchange', () => {
  beforeEach(() => {
    platform.OS = 'ios'
    vi.unstubAllGlobals()
    exchangeCodeForSession.mockReset()
    getSession.mockReset()
    getSession.mockResolvedValue({ data: { session: null } })
  })

  it('native returns to the app scheme, never the website', () => {
    expect(resolveOAuthRedirectUrl()).toBe('sheconomy://auth/callback')
    platform.OS = 'android'
    expect(resolveOAuthRedirectUrl()).toBe('sheconomy://auth/callback')
  })

  it('web returns to the current origin and keeps returnTo', () => {
    platform.OS = 'web'
    stubWindow('http://localhost:8081/auth/sign-in?returnTo=%2Fcommunity')
    const url = new URL(resolveOAuthRedirectUrl())
    expect(url.origin + url.pathname).toBe('http://localhost:8081/auth/callback')
    expect(url.searchParams.get('returnTo')).toBe('/community')
  })

  it('shares one exchange when the auth session and deep link carry the same code', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const url = 'sheconomy://auth/callback?code=11111111-2222-3333-4444-555555555555'
    const [a, b] = await Promise.all([
      exchangeOAuthUrlForSession(url),
      exchangeOAuthUrlForSession(url),
    ])
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1)
  })

  it('surfaces the provider error instead of a generic cancel', async () => {
    const result = await exchangeOAuthUrlForSession(
      'sheconomy://auth/callback?error=access_denied&error_description=User+denied+access',
    )
    expect(result.error).toBe('User denied access')
  })

  it('web rescues a code that fell back to the Site URL and strips it', async () => {
    platform.OS = 'web'
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const replaceState = stubWindow('https://www.sheconomy.in/?code=aaaa-bbbb', {
      'sb-ref-auth-token-code-verifier': '"verifier"',
    })
    expect(await completeStrayOAuthRedirect()).toBe(true)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('aaaa-bbbb')
    expect(replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('web ignores ?code when no sign-in is pending', async () => {
    platform.OS = 'web'
    stubWindow('https://www.sheconomy.in/?code=zzzz')
    expect(await completeStrayOAuthRedirect()).toBe(false)
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
