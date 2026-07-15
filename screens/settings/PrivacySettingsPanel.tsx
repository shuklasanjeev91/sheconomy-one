import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { Icons, Separator, Text, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'
import {
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '~/features/auth/services/biometric-unlock'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PrivacySettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState('Biometric unlock')
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(Platform.OS !== 'web')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cap = await getBiometricCapability()
      const on = await isBiometricUnlockEnabled()
      if (cancelled) return
      setSupported(cap.supported && cap.enrolled)
      setLabel(`${cap.label} unlock`)
      setEnabled(on)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SettingsPanel title="Privacy" description="Visibility and unlock preferences">
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <PreferenceRow icon={Icons.Eye} title="Profile visibility" subtitle="Public" />
        <Separator />
        {Platform.OS === 'web' ? (
          <YStack paddingHorizontal="$4" paddingVertical="$3.5">
            <Text fontSize={15} color={ui.text}>
              App unlock
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              Biometric unlock is available in the iOS and Android apps.
            </Text>
          </YStack>
        ) : (
          <PreferenceRow
            icon={Icons.Fingerprint}
            title={label}
            subtitle={
              loading
                ? 'Checking device…'
                : supported
                  ? 'Require unlock when opening the app with a remembered session'
                  : 'Not available — enroll biometrics or a device PIN in system settings'
            }
            checked={enabled}
            disabled={loading || !supported}
            onCheckedChange={(next) => {
              void (async () => {
                await setBiometricUnlockEnabled(next)
                setEnabled(next)
                toast.show(next ? `${label} enabled` : `${label} disabled`, {
                  tone: 'success',
                })
              })()
            }}
          />
        )}
      </SurfaceCard>
    </SettingsPanel>
  )
}
