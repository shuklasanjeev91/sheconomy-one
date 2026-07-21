import { NativeModules, Platform } from 'react-native'

export type EmailHintResult = {
  email: string | null
  error: string | null
}

function getGoogleWebClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null
}

function getGoogleIosClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || !email.includes('@')) return null
  return email
}

/**
 * Pull a device Google account email for OTP prefill (Android/iOS).
 * Prefer silent / current user; optionally open the account picker.
 */
export async function requestDeviceEmailHint(options?: {
  interactive?: boolean
}): Promise<EmailHintResult> {
  if (Platform.OS === 'web') {
    return { email: null, error: null }
  }

  const webClientId = getGoogleWebClientId()
  if (!webClientId) {
    return { email: null, error: null }
  }

  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin')

    GoogleSignin.configure({
      webClientId,
      iosClientId: getGoogleIosClientId() ?? undefined,
      offlineAccess: false,
    })

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
    } catch {
      // Continue — getCurrentUser may still work.
    }

    const current = GoogleSignin.getCurrentUser()
    const currentEmail = normalizeEmail(current?.user?.email)
    if (currentEmail) return { email: currentEmail, error: null }

    try {
      const silent = await GoogleSignin.signInSilently()
      if (silent.type === 'success') {
        const email = normalizeEmail(silent.data?.user?.email)
        if (email) return { email, error: null }
      }
    } catch {
      // No saved credential.
    }

    if (!options?.interactive) {
      return { email: null, error: null }
    }

    const response = await GoogleSignin.signIn()
    if (response.type === 'cancelled') {
      return { email: null, error: null }
    }
    const email = normalizeEmail(response.data?.user?.email)
    // Sign out so Google was only used as an email picker for OTP.
    try {
      await GoogleSignin.signOut()
    } catch {
      // ignore
    }
    return { email, error: email ? null : 'No email on that Google account.' }
  } catch (error) {
    return {
      email: null,
      error: error instanceof Error ? error.message : null,
    }
  }
}

export function isDeviceEmailHintSupported(): boolean {
  return Platform.OS !== 'web' && !!getGoogleWebClientId()
}

export function hasNativeGoogleSignInModule(): boolean {
  return Platform.OS !== 'web' && !!(NativeModules as Record<string, unknown>).RNGoogleSignin
}
