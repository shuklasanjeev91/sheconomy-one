import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'
import { useRouter } from 'one'

import { PageCenter } from '~/components/layout'
import { Spinner, Text, YStack, useAppToast } from '~/components/ui'
import { completeOAuthFromCurrentUrl } from '~/features/auth/services/oauth'
import { useAuth } from '~/hooks/useAuth'
import { buildSignInUrl, getReturnToFromLocation } from '~/lib/auth/redirect'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * OAuth redirect landing (web) and deep-link target (native: sheconomy://auth/callback).
 * Exchanges the auth code for a session, records the login, then runs completeSignIn.
 */
export default function AuthCallbackRoute() {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { completeSignIn } = useAuth()
  const [message, setMessage] = useState('Finishing sign-in…')

  useEffect(() => {
    let cancelled = false

    async function finish(url?: string | null) {
      const { error } = await completeOAuthFromCurrentUrl(url)
      if (cancelled) return
      if (error) {
        setMessage(error)
        toast.show(error, { tone: 'danger' })
        router.push(buildSignInUrl(String(getReturnToFromLocation())))
        return
      }
      setMessage('Signed in — redirecting…')
      await completeSignIn(String(getReturnToFromLocation()))
    }

    if (Platform.OS === 'web') {
      void finish()
      return () => {
        cancelled = true
      }
    }

    // The launch URL can be unrelated when the app was already running (the
    // auth session delivers the code), so only act on actual callback URLs.
    let started = false
    const finishOnce = (url: string | null) => {
      if (cancelled || started) return
      started = true
      void finish(url)
    }
    const isCallbackUrl = (url: string | null): url is string =>
      Boolean(url && /auth\/callback/.test(url) && /[?&#](code|error)=/.test(url))

    void Linking.getInitialURL().then((url) => {
      if (isCallbackUrl(url)) finishOnce(url)
    })

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isCallbackUrl(url)) finishOnce(url)
    })

    // No callback URL arrived: fall back to whatever session the auth session produced.
    const fallback = setTimeout(() => finishOnce(null), 6_000)

    return () => {
      cancelled = true
      clearTimeout(fallback)
      sub.remove()
    }
  }, [completeSignIn, router, toast])

  return (
    <PageCenter>
      <YStack alignItems="center" gap="$3" padding="$4">
        <Spinner size="large" />
        <Text fontSize={14} color={ui.textMuted} textAlign="center">
          {message}
        </Text>
      </YStack>
    </PageCenter>
  )
}
