import { useState } from 'react'

import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AuthMethodTabs, type AuthMethod } from '~/components/auth/AuthMethodTabs'
import { AuthOtpForm } from '~/components/auth/AuthOtpForm'
import { AuthShell } from '~/components/auth/AuthShell'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthSignInFlowProps = {
  returnTo?: string
}

/** Unified sign-in / sign-up OTP flow for web, iOS, and Android. */
export function AuthSignInFlow({ returnTo }: AuthSignInFlowProps) {
  const ui = useAppUi()
  const { completeSignIn } = useAuth()
  const [mode, setMode] = useState<AuthMethod>('email')

  return (
    <AuthShell
      footer={
        <XStack
          alignItems="flex-start"
          gap="$2"
          paddingTop="$3"
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
        <AuthMethodTabs value={mode} onChange={setMode} />
        <AuthOtpForm key={mode} channel={mode} onSuccess={() => completeSignIn(returnTo)} />
      </YStack>
    </AuthShell>
  )
}

/** @deprecated Use AuthSignInFlow */
export const SignInPanel = AuthSignInFlow
