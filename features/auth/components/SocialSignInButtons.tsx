import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { AppleSignInButton } from '~/features/auth/components/AppleSignInButton'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  isAppleSignInAvailable,
  startOAuthSignIn,
  type OAuthProvider,
} from '~/features/auth/services/oauth'
import { useAppUi } from '~/lib/theme/useAppUi'

type SocialSignInButtonsProps = {
  disabled?: boolean
  requireConsent?: boolean
  acceptedTerms?: boolean
  /** Called after a successful native / non-redirect social sign-in. */
  onSuccess?: (provider: OAuthProvider) => void
}

const APPLE_BUTTON_HEIGHT = 48

/** Load only on iOS so web/Android bundles stay free of the native Apple button view. */
const AppleAuthentication =
  Platform.OS === 'ios'
    ? (require('expo-apple-authentication') as typeof import('expo-apple-authentication'))
    : null

export function SocialSignInButtons({
  disabled,
  requireConsent,
  acceptedTerms,
  onSuccess,
}: SocialSignInButtonsProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  /** iOS: only render Apple's system button after `isAvailableAsync()` is true. */
  const [appleNativeReady, setAppleNativeReady] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios' || !AppleAuthentication) return
    let cancelled = false
    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) setAppleNativeReady(available)
      })
      .catch(() => {
        if (!cancelled) setAppleNativeReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handle(provider: OAuthProvider) {
    if (requireConsent && !acceptedTerms) {
      toast.show('Please accept Terms and Privacy to continue', { tone: 'warning' })
      return
    }
    if (busy != null) return
    setBusy(provider)
    try {
      const result = await startOAuthSignIn(provider)
      if (result.error) {
        toast.show(result.error, { tone: 'danger' })
        return
      }
      if (result.pendingRedirect) return
      onSuccess?.(provider)
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to complete social sign-in. Please try again.'
      toast.show(message, { tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const controlsLocked = Boolean(disabled || busy != null)
  const showWebAppleButton = Platform.OS === 'web' && isAppleSignInAvailable()
  const showIosAppleButton =
    Platform.OS === 'ios' && appleNativeReady && AppleAuthentication != null

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$3">
        <YStack flex={1} height={1} backgroundColor={ui.borderSubtle} />
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          {Platform.OS === 'web' ? 'Or continue with' : 'Continue with'}
        </Text>
        <YStack flex={1} height={1} backgroundColor={ui.borderSubtle} />
      </XStack>
      {/* Apple first — App Store Guideline 4.8 / review discoverability above the fold. */}
      {isAppleSignInAvailable() ? (
        <AppleSignInButton
          disabled={disabled || busy != null}
          busy={busy === 'apple'}
          onPress={() => void handle('apple')}
        />
      ) : null}
      <Button
        tone="outline"
        size="$4"
        borderRadius={999}
        disabled={controlsLocked}
        onPress={() => void handle('google')}
        icon={busy === 'google' ? <Spinner size="small" /> : undefined}
      >
        {busy === 'google' ? 'Connecting…' : 'Continue with Google'}
      </Button>
    </YStack>
  )
}
