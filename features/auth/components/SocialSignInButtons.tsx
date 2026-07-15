import { useState } from 'react'
import { Platform } from 'react-native'

import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  isAppleSignInAvailable,
  startOAuthSignIn,
} from '~/features/auth/services/oauth'
import { useAppUi } from '~/lib/theme/useAppUi'

type SocialSignInButtonsProps = {
  disabled?: boolean
  requireConsent?: boolean
  acceptedTerms?: boolean
}

export function SocialSignInButtons({
  disabled,
  requireConsent,
  acceptedTerms,
}: SocialSignInButtonsProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null)

  async function handle(provider: 'google' | 'apple') {
    if (requireConsent && !acceptedTerms) {
      toast.show('Please accept Terms and Privacy to continue', { tone: 'warning' })
      return
    }
    setBusy(provider)
    const result = await startOAuthSignIn(provider)
    setBusy(null)
    if (result.error) {
      toast.show(result.error, { tone: 'danger' })
    }
  }

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
        disabled={disabled || busy != null}
        onPress={() => void handle('google')}
        icon={busy === 'google' ? <Spinner size="small" /> : undefined}
      >
        {busy === 'google' ? 'Connecting…' : 'Continue with Google'}
      </Button>
      {isAppleSignInAvailable() ? (
        <Button
          tone="outline"
          size="$4"
          borderRadius={999}
          disabled={disabled || busy != null}
          onPress={() => void handle('apple')}
          icon={busy === 'apple' ? <Spinner size="small" /> : undefined}
        >
          {busy === 'apple'
            ? 'Connecting…'
            : Platform.OS === 'ios'
              ? 'Sign in with Apple'
              : 'Continue with Apple'}
        </Button>
      ) : null}
    </YStack>
  )
}
