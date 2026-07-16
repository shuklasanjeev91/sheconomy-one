import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
          cancel: () => void
        }
      }
    }
  }
}

export function getGoogleWebClientId(): string | null {
  const id = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()
  return id || null
}

export function isGoogleOneTapSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!getGoogleWebClientId()
}

let scriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google One Tap is web-only'))
  }
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity')))
      if (window.google?.accounts?.id) resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.gis = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

export type OneTapResult = { error: string | null; cancelled?: boolean }

/**
 * Shows Google One Tap / FedCM prompt and exchanges the ID token with Supabase.
 * Call only after terms consent on the sign-in screen.
 */
export async function promptGoogleOneTap(): Promise<OneTapResult> {
  if (!isGoogleOneTapSupported()) {
    return { error: 'Google One Tap is not configured.' }
  }

  const clientId = getGoogleWebClientId()!
  try {
    await loadGisScript()
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to load Google Sign-In',
    }
  }

  return new Promise((resolve) => {
    let settled = false
    let promptVisible = false
    const finish = (result: OneTapResult) => {
      if (settled) return
      settled = true
      try {
        window.google?.accounts.id.cancel()
      } catch {
        // ignore
      }
      resolve(result)
    }

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) {
          finish({ error: 'Google did not return a credential.' })
          return
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        })
        if (error) {
          finish({ error: error.message || 'Google sign-in failed.' })
          return
        }
        finish({ error: null })
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      use_fedcm_for_prompt: true,
    })

    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        finish({ error: null, cancelled: true })
        return
      }
      promptVisible = true
    })

    // Only time out if the prompt never appeared.
    setTimeout(() => {
      if (!promptVisible) finish({ error: null, cancelled: true })
    }, 12_000)
  })
}

/** Cancel any in-flight One Tap UI. */
export function cancelGoogleOneTap() {
  if (Platform.OS !== 'web') return
  try {
    window.google?.accounts.id.cancel()
  } catch {
    // ignore
  }
}
