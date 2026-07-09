import { useState } from 'react'

import { AuthMethodToggle, type AuthMethod } from '~/components/auth/AuthMethodToggle'
import { AuthScreen } from '~/components/auth/AuthScreen'
import { OtpAuthForm } from '~/components/auth/OtpAuthForm'
import { AUTH_COPY } from '~/components/auth/auth-copy'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

type SignInPanelProps = {
  /** Path to open after a successful sign-in. */
  returnTo?: string
}

export function SignInPanel({ returnTo }: SignInPanelProps) {
  const ui = useAppUi()
  const { completeSignIn } = useAuth()
  const [mode, setMode] = useState<AuthMethod>('email')

  return (
    <AuthScreen
      footer={
        <XStack
          alignItems="flex-start"
          gap="$2"
          paddingTop="$2"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
        >
          <Icons.ShieldCheck size={14} color={ui.textMuted} marginTop={2} />
          <Text fontSize={12} color={ui.textMuted} lineHeight={18} flex={1}>
            {AUTH_COPY.footerLegal}
          </Text>
        </XStack>
      }
    >
      <YStack gap="$5">
        <AuthMethodToggle value={mode} onChange={setMode} />
        <OtpAuthForm
          key={mode}
          channel={mode}
          onSuccess={() => completeSignIn(returnTo)}
        />
      </YStack>
    </AuthScreen>
  )
}