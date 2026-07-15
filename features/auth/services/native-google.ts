import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'

function getGoogleWebClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null
}

function getGoogleIosClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null
}

/**
 * Native Google account selector (Credential Manager / Google Sign-In).
 * Returns handled=false so callers can fall back to browser OAuth.
 */
export async function tryNativeGoogleSignIn(): Promise<{
  handled: boolean
  error: string | null
}> {
  if (Platform.OS === 'web') return { handled: false, error: null }

  const webClientId = getGoogleWebClientId()
  if (!webClientId) return { handled: false, error: null }

  try {
    const GoogleSignin = await import('@react-native-google-signin/google-signin')
    GoogleSignin.GoogleSignin.configure({
      webClientId,
      iosClientId: getGoogleIosClientId() ?? undefined,
      offlineAccess: false,
    })

    await GoogleSignin.GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    })

    const response = await GoogleSignin.GoogleSignin.signIn()
    if (response.type === 'cancelled') {
      return { handled: true, error: 'Google sign-in was cancelled.' }
    }

    const idToken =
      response.data?.idToken ??
      (await GoogleSignin.GoogleSignin.getTokens().then((t) => t.idToken).catch(() => null))

    if (!idToken) {
      return { handled: true, error: 'Google did not return an ID token.' }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })

    if (error) {
      return { handled: true, error: error.message || 'Google sign-in failed.' }
    }
    return { handled: true, error: null }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code?: string }).code).includes('SIGN_IN_CANCELLED')
    ) {
      return { handled: true, error: 'Google sign-in was cancelled.' }
    }
    // Module / config missing → browser OAuth fallback.
    return { handled: false, error: null }
  }
}
