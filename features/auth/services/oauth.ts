import { Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '~/lib/supabase/client'

WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple'

function resolveRedirectUrl(): string {
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WEB_APP_URL) {
    return `${process.env.EXPO_PUBLIC_WEB_APP_URL.replace(/\/$/, '')}/auth/sign-in`
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/sign-in`
  }
  return 'sheconomy://auth/sign-in'
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'web'
}

/**
 * Starts Google / Apple OAuth via Supabase. Secrets stay on the server;
 * the client only receives the auth URL.
 */
export async function startOAuthSignIn(
  provider: OAuthProvider,
): Promise<{ error: string | null }> {
  if (provider === 'apple' && !isAppleSignInAvailable()) {
    return { error: 'Sign in with Apple is available on iOS and Web.' }
  }

  const redirectTo = resolveRedirectUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  })

  if (error) {
    return { error: 'Unable to start social sign-in. Please try again.' }
  }

  if (Platform.OS !== 'web' && data.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  }

  return { error: null }
}
