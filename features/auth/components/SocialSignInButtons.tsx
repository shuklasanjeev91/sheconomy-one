import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  isAppleSignInAvailable,
  isLinkedInSignInAvailable,
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
      if (result.cancelled) return
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
          Or continue with
        </Text>
        <YStack flex={1} height={1} backgroundColor={ui.borderSubtle} />
      </XStack>
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

      {showIosAppleButton && AppleAuthentication ? (
        <YStack
          width="100%"
          height={APPLE_BUTTON_HEIGHT}
          opacity={controlsLocked ? 0.55 : 1}
          pointerEvents={controlsLocked ? 'none' : 'auto'}
        >
          {busy === 'apple' ? (
            <XStack
              height={APPLE_BUTTON_HEIGHT}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              borderRadius={999}
              borderWidth={1}
              borderColor={ui.borderSubtle}
            >
              <Spinner size="small" />
              <Text fontSize={15} fontWeight="700" color={ui.text}>
                Connecting…
              </Text>
            </XStack>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
              cornerRadius={999}
              style={{ width: '100%', height: APPLE_BUTTON_HEIGHT }}
              onPress={() => void handle('apple')}
            />
          )}
        </YStack>
      ) : null}

      {showWebAppleButton ? (
        <Button
          tone="outline"
          size="$4"
          borderRadius={999}
          disabled={controlsLocked}
          onPress={() => void handle('apple')}
          icon={busy === 'apple' ? <Spinner size="small" /> : undefined}
        >
          {busy === 'apple' ? 'Connecting…' : 'Continue with Apple'}
        </Button>
      ) : null}

      {isLinkedInSignInAvailable() ? (
        <Button
          tone="outline"
          size="$4"
          borderRadius={999}
          disabled={controlsLocked}
          onPress={() => void handle('linkedin_oidc')}
          icon={busy === 'linkedin_oidc' ? <Spinner size="small" /> : undefined}
        >
          {busy === 'linkedin_oidc' ? 'Connecting…' : 'Continue with LinkedIn'}
        </Button>
      ) : null}
    </YStack>
  )
}
