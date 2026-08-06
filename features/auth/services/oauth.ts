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
): Promise<{ error: string | null; pendingRedirect?: boolean }> {
  if (provider === 'apple' && !isAppleSignInAvailable()) {
    return { error: 'Sign in with Apple is available on iOS and Web.' }
  }

  // Prefer native Apple ID token on iOS when the module is installed.
  if (provider === 'apple' && Platform.OS === 'ios') {
    const native = await tryNativeAppleSignIn()
    if (native.handled) return { error: native.error }
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

async function tryNativeAppleSignIn(): Promise<{ handled: boolean; error: string | null }> {
  let AppleAuthentication: typeof import('expo-apple-authentication')
  try {
    AppleAuthentication = await import('expo-apple-authentication')
  } catch {
    // Module unavailable in this binary — allow browser OAuth fallback.
    return { handled: false, error: null }
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      return { handled: false, error: null }
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
      return { handled: true, error: 'Apple did not return an identity token.' }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })

    if (error) {
      return { handled: true, error: error.message || 'Apple sign-in failed.' }
    }
    return { handled: true, error: null }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return { handled: true, error: 'Apple sign-in was cancelled.' }
    }
    // Native Apple UI was presented (or timed out). Do not silently fall back to
    // browser OAuth — that path often appears "unresponsive" on App Review devices.
    if (error instanceof Error && error.message) {
      return { handled: true, error: error.message }
    }
    return { handled: true, error: 'Apple sign-in failed. Please try again.' }
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
