import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import type { Provider } from '@supabase/supabase-js'

import { normalizeAppOrigin } from '~/config/app-origin'
import { tryNativeGoogleSignIn } from '~/features/auth/services/native-google'
import { supabase } from '~/lib/supabase/client'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple' | 'linkedin_oidc'

export function resolveOAuthRedirectUrl(): string {
  // Web OAuth must return to the current host (localhost / preview allowlists).
  // Public share + notification links use resolveAppOrigin() → sheconomy.in.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL) {
    return `${normalizeAppOrigin(process.env.EXPO_PUBLIC_WEB_APP_URL)}/auth/callback`
  }
  return 'sheconomy://auth/callback'
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

export async function exchangeOAuthUrlForSession(
  url: string | null | undefined,
): Promise<{ error: string | null }> {
  const code = extractAuthCode(url)
  if (!code) {
    return { error: 'Social sign-in was cancelled or incomplete.' }
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return { error: error.message || 'Unable to complete social sign-in.' }
  }
  return { error: null }
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
  // back to browser OAuth — that looks like a dead / non-responsive button.
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
          ? { access_type: 'offline', prompt: 'consent' }
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
    // AuthorizationError code 1000 — usually missing Sign in with Apple entitlement.
    if (code === 'ERR_REQUEST_UNKNOWN' || message.includes('1000')) {
      return 'Sign in with Apple is not available on this build. Please try again or use another sign-in method.'
    }
    if (message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Apple sign-in failed. Please try again.'
}

async function tryNativeAppleSignIn(): Promise<{
  error: string | null
  cancelled?: boolean
}> {
  let AppleAuthentication: typeof import('expo-apple-authentication')
  try {
    AppleAuthentication = await import('expo-apple-authentication')
  } catch {
    return { error: 'Sign in with Apple is not available on this build.' }
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
      return { error: error.message || 'Apple sign-in failed.' }
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
