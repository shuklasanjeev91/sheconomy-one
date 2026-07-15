import { Icons, Separator } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'

export function PrivacySettingsPanel() {
  return (
    <SettingsPanel title="Privacy" description="Visibility and unlock preferences">
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <PreferenceRow icon={Icons.Eye} title="Profile visibility" subtitle="Public" />
        <Separator />
        <PreferenceRow icon={Icons.Fingerprint} title="Biometric unlock" defaultChecked />
      </SurfaceCard>
    </SettingsPanel>
  )
}
