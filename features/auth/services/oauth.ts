import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import type { Provider } from '@supabase/supabase-js'

import { APP_SCHEME } from '~/config/app-origin'
import { tryNativeGoogleSignIn } from '~/features/auth/services/native-google'
import { AUTH_RETURN_TO_PARAM, getReturnToFromLocation } from '~/lib/auth/redirect'
import { supabase } from '~/lib/supabase/client'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple' | 'linkedin_oidc'

export const OAUTH_CALLBACK_PATH = '/auth/callback'

export function resolveOAuthRedirectUrl(): string {
  // Web OAuth must return to the current host (localhost / preview allowlists).
  // Public share + notification links use resolveAppOrigin() → sheconomy.in.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const callback = `${window.location.origin}${OAUTH_CALLBACK_PATH}`
    const returnTo = String(getReturnToFromLocation())
    return returnTo === '/'
      ? callback
      : `${callback}?${new URLSearchParams({ [AUTH_RETURN_TO_PARAM]: returnTo })}`
  }
  // Native must use the custom scheme: ASWebAuthenticationSession and the
  // Android auth tab only hand an https redirect back to the app when it is a
  // verified universal/app link, so an https callback strands users on the website.
  return `${APP_SCHEME}://auth/callback`
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'web'
}

export function isLinkedInSignInAvailable(): boolean {
  // LinkedIn sign-in removed from the product surface (still linkable only if already connected).
  return false
}

function extractAuthCode(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const code = parsed.searchParams.get('code')
    if (code) return code
    // Some flows put params in the hash.
    if (parsed.hash) {
      const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
      return hash.get('code')
    }
  } catch {
    const match = url.match(/[?&#]code=([^&]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return null
}

function extractAuthError(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const params = parsed.searchParams.has('error')
      ? parsed.searchParams
      : new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const description = params.get('error_description') ?? params.get('error')
    return description ? description.replace(/\+/g, ' ') : null
  } catch {
    return null
  }
}

// On Android the auth session result and the /auth/callback deep link both
// carry the same single-use code; share one exchange so neither reports failure.
const exchangesByCode = new Map<string, Promise<{ error: string | null }>>()

async function exchangeCode(code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) return { error: null }
  // Code already used (another exchange won the race) but a session exists.
  const { data } = await supabase.auth.getSession()
  if (data.session) return { error: null }
  return { error: error.message || 'Unable to complete social sign-in.' }
}

export async function exchangeOAuthUrlForSession(
  url: string | null | undefined,
): Promise<{ error: string | null }> {
  const code = extractAuthCode(url)
  if (!code) {
    const providerError = extractAuthError(url)
    if (providerError) return { error: providerError }
    const { data } = await supabase.auth.getSession()
    if (data.session) return { error: null }
    return { error: 'Social sign-in was cancelled or incomplete.' }
  }

  let pending = exchangesByCode.get(code)
  if (!pending) {
    pending = exchangeCode(code)
    exchangesByCode.set(code, pending)
  }
  return pending
}

const PKCE_VERIFIER_SUFFIX = '-code-verifier'

function hasPendingPkceVerifier(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith('sb-') && key.endsWith(PKCE_VERIFIER_SUFFIX)) {
        return Boolean(window.localStorage.getItem(key))
      }
    }
  } catch {
    // Storage blocked (private mode / sandboxed iframe).
  }
  return false
}

/**
 * Web: Supabase falls back to the Site URL when the requested redirect is not
 * allowlisted, so the `?code=` can land on any page instead of /auth/callback.
 * Finish that sign-in in place and strip the code from the address bar.
 * Returns true when a session was established.
 */
export async function completeStrayOAuthRedirect(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  const { pathname, href } = window.location
  if (pathname === OAUTH_CALLBACK_PATH) return false
  const code = extractAuthCode(href)
  if (!code || !hasPendingPkceVerifier()) return false

  const { error } = await exchangeOAuthUrlForSession(href)
  const cleaned = new URL(href)
  cleaned.searchParams.delete('code')
  window.history.replaceState(window.history.state, '', cleaned.pathname + cleaned.search + cleaned.hash)
  return !error
}

/**
 * Completes an OAuth redirect that landed on /auth/callback (web or deep link).
 */
export async function completeOAuthFromCurrentUrl(
  url?: string | null,
): Promise<{ error: string | null }> {
  const candidate =
    url ??
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null)
  return exchangeOAuthUrlForSession(candidate)
}

/**
 * Starts Google / Apple / LinkedIn OAuth via Supabase.
 * Native: opens an auth session and exchanges the returned code.
 * Web: browser redirect (session picked up on /auth/callback).
 */
export async function startOAuthSignIn(
  provider: OAuthProvider,
): Promise<{ error: string | null; pendingRedirect?: boolean; cancelled?: boolean }> {
  if (provider === 'apple' && !isAppleSignInAvailable()) {
    return { error: 'Sign in with Apple is available on iOS and Web.' }
  }

  // iOS must use native Sign in with Apple (App Store). Do not silently fall
  // back to browser OAuth — that path often appears unresponsive on review devices.
  if (provider === 'apple' && Platform.OS === 'ios') {
    return tryNativeAppleSignIn()
  }

  // Prefer native Google account picker on iOS/Android when configured.
  if (provider === 'google' && Platform.OS !== 'web') {
    const native = await tryNativeGoogleSignIn()
    if (native.handled) return { error: native.error }
  }

  const redirectTo = resolveOAuthRedirectUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams:
        provider === 'google'
          ? { prompt: 'select_account' }
          : undefined,
    },
  })

  if (error) {
    return { error: error.message || 'Unable to start social sign-in. Please try again.' }
  }

  if (Platform.OS === 'web') {
    // Browser navigates away; callback route finishes the session.
    return { error: null, pendingRedirect: true }
  }

  if (!data.url) {
    return { error: 'Unable to start social sign-in. Please try again.' }
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (result.type !== 'success') {
    return { error: 'Social sign-in was cancelled.' }
  }

  return exchangeOAuthUrlForSession(result.url)
}

const APPLE_SIGN_IN_TIMEOUT_MS = 90_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isAppleSignInCanceled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = String((error as { code?: string }).code ?? '')
  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_REQUEST_CANCELLED' ||
    code === 'ERR_CANCELED'
  )
}

function appleSignInErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = String((error as { code?: string }).code ?? '')
    const message = String((error as { message?: string }).message ?? '')
    const combined = `${code} ${message}`.toLowerCase()
    // iPadOS shows a system alert + Settings button when Apple Account/iCloud
    // session is incomplete (e.g. Settings shows name but iCloud is still "Set Up").
    if (
      combined.includes('settings') ||
      combined.includes('apple account') ||
      combined.includes('apple id') ||
      combined.includes('icloud')
    ) {
      return 'Finish Apple Account setup in Settings (open iCloud and complete Set Up), then try Sign in with Apple again.'
    }
    // AuthorizationError code 1000 — entitlement / AuthKit session issues.
    if (code === 'ERR_REQUEST_UNKNOWN' || message.includes('1000')) {
      return 'Sign in with Apple could not start. In Settings → Apple Account, finish iCloud setup, then try again.'
    }
    if (message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Apple sign-in failed. Please try again.'
}

/**
 * Native Sign in with Apple → Supabase ID token exchange.
 * Always returns an explicit error or cancelled flag — never a silent no-op success.
 */
async function tryNativeAppleSignIn(): Promise<{
  error: string | null
  cancelled?: boolean
}> {
  let AppleAuthentication: typeof import('expo-apple-authentication')
  try {
    AppleAuthentication = await import('expo-apple-authentication')
  } catch {
    return {
      error:
        'Sign in with Apple is missing from this build. Please update the app or use another sign-in method.',
    }
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      return { error: 'Sign in with Apple is not available on this device.' }
    }

    const credential = await withTimeout(
      AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      }),
      APPLE_SIGN_IN_TIMEOUT_MS,
      'Sign in with Apple timed out. Please try again.',
    )

    if (!credential.identityToken) {
      return { error: 'Apple did not return an identity token. Please try again.' }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })

    if (error) {
      const msg = error.message || 'Apple sign-in failed.'
      const lower = msg.toLowerCase()
      if (lower.includes('not enabled') || lower.includes('provider_disabled')) {
        return {
          error:
            'Apple sign-in is not enabled on the server. Enable the Apple provider in Supabase Auth, then try again.',
        }
      }
      if (lower.includes('audience') || lower.includes('client id') || lower.includes('unacceptable')) {
        return {
          error:
            'Apple sign-in is misconfigured (bundle ID missing from Supabase Apple Client IDs).',
        }
      }
      return { error: msg }
    }

    // Full name is only returned the first time the user authorizes the app.
    const given = credential.fullName?.givenName?.trim()
    const family = credential.fullName?.familyName?.trim()
    const fullName = [given, family].filter(Boolean).join(' ')
    if (fullName) {
      void supabase.auth.updateUser({
        data: {
          full_name: fullName,
          given_name: given ?? undefined,
          family_name: family ?? undefined,
        },
      })
    }

    return { error: null }
  } catch (error) {
    if (isAppleSignInCanceled(error)) {
      return { error: null, cancelled: true }
    }
    return { error: appleSignInErrorMessage(error) }
  }
}

export async function linkOAuthIdentity(
  provider: OAuthProvider,
): Promise<{ error: string | null }> {
  const redirectTo = resolveOAuthRedirectUrl()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: provider as Provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  })

  if (error) return { error: error.message }

  if (Platform.OS !== 'web' && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') return { error: 'Linking was cancelled.' }
    return exchangeOAuthUrlForSession(result.url)
  }

  return { error: null }
}
