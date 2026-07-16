import { Icons } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { pushPlatformLabel } from '~/components/settings/pushPlatformLabel'
import { useSettingsPushSync } from '~/components/settings/useSettingsPushSync'

export function NotificationsSettingsPanel() {
  const { pushConfigured, permissionGranted, pushBusy, syncDevicePush } = useSettingsPushSync()

  return (
    <SettingsPanel
      title="Notifications"
      description="Master switch for push on this browser or app install. Product sections control what each tab sends."
    >
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <PreferenceRow
          icon={Icons.Smartphone}
          title={`${pushPlatformLabel()} push`}
          subtitle={
            !pushConfigured
              ? 'OneSignal App ID not configured — push needs a production build on iOS/Android'
              : permissionGranted
                ? 'Enabled for this browser or app install'
                : 'Turn on to get alerts across Commerce, Community, Chat, Class, and Co-Work'
          }
          checked={permissionGranted}
          disabled={pushBusy || !pushConfigured}
          onCheckedChange={(checked) => void syncDevicePush(checked)}
        />
      </SurfaceCard>
    </SettingsPanel>
  )
}
