import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { PageCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  markBiometricUnlocked,
  shouldRequireBiometricUnlock,
} from '~/features/auth/services/biometric-unlock'
import { useAuth } from '~/hooks/useAuth'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Blocks the app shell until biometric / device passcode succeeds when
 * the user enabled unlock and a remembered session exists.
 */
export function BiometricUnlockGate({ children }: { children: React.ReactNode }) {
  const ui = useAppUi()
  const { session, isLoading } = useSupabase()
  const { signOutLocal } = useAuth()
  const [checking, setChecking] = useState(Platform.OS !== 'web')
  const [locked, setLocked] = useState(false)
  const [label, setLabel] = useState('Biometrics')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evaluate = useCallback(async () => {
    if (Platform.OS === 'web' || isLoading) {
      setChecking(false)
      setLocked(false)
      return
    }
    setChecking(true)
    const cap = await getBiometricCapability()
    setLabel(cap.label)
    const need = await shouldRequireBiometricUnlock(!!session?.user)
    setLocked(need)
    setChecking(false)
    if (need) {
      const result = await authenticateWithBiometrics(`Unlock SHEconomy with ${cap.label}`)
      if (result.success) setLocked(false)
      else setError(result.error)
    }
  }, [isLoading, session?.user])

  useEffect(() => {
    void evaluate()
  }, [evaluate])

  useEffect(() => {
    if (!session?.user) {
      void markBiometricUnlocked(false)
      setLocked(false)
    }
  }, [session?.user])

  if (Platform.OS === 'web') return <>{children}</>
  if (isLoading || checking) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }
  if (!locked) return <>{children}</>

  return (
    <PageCenter>
      <YStack alignItems="center" gap="$4" padding="$5" maxWidth={360}>
        <Icons.Fingerprint size={40} color={ui.brand} />
        <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
          Unlock SHEconomy
        </Text>
        <Text fontSize={14} color={ui.textMuted} textAlign="center" lineHeight={20}>
          Use {label} or your device passcode to continue on this device.
        </Text>
        {error ? (
          <Text fontSize={13} color="$red10" textAlign="center">
            {error}
          </Text>
        ) : null}
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={busy}
          onPress={() => {
            void (async () => {
              setBusy(true)
              setError(null)
              const result = await authenticateWithBiometrics(`Unlock SHEconomy with ${label}`)
              setBusy(false)
              if (result.success) setLocked(false)
              else setError(result.error)
            })()
          }}
        >
          {busy ? 'Waiting…' : `Unlock with ${label}`}
        </Button>
        <Button
          tone="ghost"
          size="$3"
          disabled={busy}
          onPress={() => {
            void signOutLocal()
          }}
        >
          Sign out instead
        </Button>
      </YStack>
    </PageCenter>
  )
}
