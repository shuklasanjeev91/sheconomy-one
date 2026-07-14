import { useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { AuthMethodTabs, type AuthMethod } from '~/components/auth/AuthMethodTabs'
import { AuthOtpForm } from '~/components/auth/AuthOtpForm'
import { AuthShell } from '~/components/auth/AuthShell'
import { Field, Icons, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { AuthConsent } from '~/features/auth/components/AuthConsent'
import { SocialSignInButtons } from '~/features/auth/components/SocialSignInButtons'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthSignInFlowProps = {
  returnTo?: string
}

/** Unified sign-in / sign-up OTP flow for web, iOS, and Android. */
export function AuthSignInFlow({ returnTo }: AuthSignInFlowProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { completeSignIn } = useAuth()
  const [mode, setMode] = useState<AuthMethod>('email')
  const [fullName, setFullName] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)

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
        <Field label="Full name (optional for returning members)">
          <XStack
            alignItems="center"
            gap="$3"
            paddingHorizontal="$3"
            height={56}
            borderRadius={AUTH_LAYOUT.inputRadius}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
          >
            <Icons.User size={18} color={ui.textMuted} />
            <Input
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
              {...(Platform.OS === 'web' ? ({ autoComplete: 'name' } as object) : {})}
            />
          </XStack>
        </Field>

        <AuthConsent
          accepted={acceptedTerms}
          onChange={(next) => {
            setAcceptedTerms(next)
            if (next) setConsentError(null)
          }}
          error={consentError}
        />

        <AuthMethodTabs value={mode} onChange={setMode} />
        <AuthOtpForm
          key={mode}
          channel={mode}
          fullName={fullName}
          acceptedTerms={acceptedTerms}
          onRequireConsent={() => {
            setConsentError('Please accept the Terms and Privacy Policy to continue.')
            toast.show('Consent required', {
              tone: 'warning',
              message: 'Accept Terms and Privacy to send a verification code.',
            })
          }}
          onSuccess={({ isNewUser }) => {
            if (isNewUser) {
              router.replace({
                pathname: '/auth/import-contacts',
                params: { returnTo: returnTo ?? '' },
              } as never)
              return
            }
            void completeSignIn(returnTo)
          }}
        />

        <SocialSignInButtons
          requireConsent
          acceptedTerms={acceptedTerms}
        />
      </YStack>
    </AuthShell>
  )
}

/** @deprecated Use AuthSignInFlow */
export const SignInPanel = AuthSignInFlow
