import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AuthMethodTabs, type AuthMethod } from '~/components/auth/AuthMethodTabs'
import { AuthOtpForm } from '~/components/auth/AuthOtpForm'
import { AuthShell } from '~/components/auth/AuthShell'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { GoogleOneTap } from '~/features/auth/components/GoogleOneTap'
import { SocialSignInButtons } from '~/features/auth/components/SocialSignInButtons'
import { QrLoginPanel } from '~/features/auth/components/QrLoginPanel'
import {
  isPasskeySignInSupported,
  signInWithPasskey,
} from '~/features/auth/services/passkeys'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthSignInFlowProps = {
  returnTo?: string
}

/** Unified sign-in / sign-up OTP flow for web, iOS, and Android. */
export function AuthSignInFlow({ returnTo }: AuthSignInFlowProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { completeSignIn } = useAuth()
  const [mode, setMode] = useState<AuthMethod>('email')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [showQrLogin, setShowQrLogin] = useState(false)
  // Delay One Tap so its iframe cannot steal focus from email/phone fields.
  const [oneTapReady, setOneTapReady] = useState(false)
  const passkeysAvailable = isPasskeySignInSupported()

  useEffect(() => {
    const timer = setTimeout(() => setOneTapReady(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const finishSocial = useCallback(() => {
    void completeSignIn(returnTo, { provider: 'google' })
  }, [completeSignIn, returnTo])

  async function handlePasskey() {
    setPasskeyBusy(true)
    const result = await signInWithPasskey()
    setPasskeyBusy(false)
    if (result.error) {
      toast.show(result.error, { tone: 'danger' })
      return
    }
    void completeSignIn(returnTo, { provider: 'passkey' })
  }

  return (
    <AuthShell
      returnTo={returnTo}
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
        <GoogleOneTap enabled={oneTapReady} onSuccess={finishSocial} />

        {/* Social first on native so Sign in with Apple is equally prominent (App Store 4.8). */}
        {Platform.OS !== 'web' ? (
          <SocialSignInButtons
            onSuccess={(provider) => {
              void completeSignIn(returnTo, { provider })
            }}
          />
        ) : null}

        <AuthMethodTabs value={mode} onChange={setMode} />
        <AuthOtpForm
          key={mode}
          channel={mode}
          onSuccess={({ isNewUser }) => {
            void completeSignIn(returnTo, { provider: mode, isNewUser })
          }}
        />

        {mode !== 'phone' ? (
          <Button
            tone="outline"
            size="$4"
            borderRadius={999}
            onPress={() => setMode('phone')}
            icon={<Icons.Smartphone size={18} />}
          >
            Log in with phone
          </Button>
        ) : null}

        {passkeysAvailable ? (
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={passkeyBusy}
            onPress={() => void handlePasskey()}
            icon={passkeyBusy ? <Spinner size="small" /> : <Icons.Fingerprint size={18} />}
          >
            {passkeyBusy ? 'Checking passkey…' : 'Continue with passkey'}
          </Button>
        ) : null}

        {Platform.OS === 'web' ? (
          <>
            <SocialSignInButtons
              onSuccess={(provider) => {
                void completeSignIn(returnTo, { provider })
              }}
            />
            {showQrLogin ? (
              <QrLoginPanel
                onSuccess={() => void completeSignIn(returnTo, { provider: 'qr' })}
                onCancel={() => setShowQrLogin(false)}
              />
            ) : (
              <Button tone="ghost" size="$3" onPress={() => setShowQrLogin(true)}>
                Approve browser login with QR code
              </Button>
            )}
          </>
        ) : null}
      </YStack>
    </AuthShell>
  )
}

/** @deprecated Use AuthSignInFlow */
export const SignInPanel = AuthSignInFlow
