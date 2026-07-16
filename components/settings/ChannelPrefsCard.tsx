import type { ReactNode } from 'react'

import { Icons, Separator, Spinner, Text, XStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import type { ChannelNotificationPrefs } from '~/lib/notifications/product-preferences'
import { useAppUi } from '~/lib/theme/useAppUi'

import { PreferenceRow, SettingsSectionHeading } from './SettingsPanel'
import { pushPlatformLabel } from './pushPlatformLabel'

export function ChannelPrefsCard({
  title,
  loading,
  saving,
  pushConfigured,
  permissionGranted,
  pushBusy,
  prefs,
  emailSubtitle,
  whatsappSubtitle,
  hideWhatsApp,
  onChange,
  extraRows,
}: {
  title?: string
  loading: boolean
  saving: boolean
  pushConfigured: boolean
  permissionGranted: boolean
  pushBusy: boolean
  prefs: Pick<
    ChannelNotificationPrefs,
    'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'whatsappEnabled'
  >
  emailSubtitle: string
  whatsappSubtitle: string
  hideWhatsApp?: boolean
  onChange: (key: keyof ChannelNotificationPrefs, value: boolean) => void
  extraRows?: ReactNode
}) {
  const ui = useAppUi()

  return (
    <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
      {title ? (
        <XStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
          <SettingsSectionHeading title={title} />
        </XStack>
      ) : null}
      {loading ? (
        <XStack padding="$4" alignItems="center" gap="$2">
          <Spinner size="small" />
          <Text color={ui.textSecondary} fontSize={13}>
            Loading preferences…
          </Text>
        </XStack>
      ) : (
        <>
          <PreferenceRow
            icon={Icons.Bell}
            title="In-app"
            subtitle="Toasts + inbox on web, iOS, and Android"
            checked={prefs.inAppEnabled}
            disabled={saving}
            onCheckedChange={(checked) => onChange('inAppEnabled', checked)}
          />
          <Separator />
          <PreferenceRow
            icon={Icons.Mail}
            title="Email"
            subtitle={emailSubtitle}
            checked={prefs.emailEnabled}
            disabled={saving}
            onCheckedChange={(checked) => onChange('emailEnabled', checked)}
          />
          <Separator />
          <PreferenceRow
            icon={Icons.Smartphone}
            title="Push"
            subtitle={
              !pushConfigured
                ? 'Push App ID not configured'
                : permissionGranted
                  ? `On for this ${pushPlatformLabel()} device`
                  : 'Enable browser or device push alerts'
            }
            checked={prefs.pushEnabled && permissionGranted}
            disabled={saving || pushBusy || !pushConfigured}
            onCheckedChange={(checked) => onChange('pushEnabled', checked)}
          />
          {!hideWhatsApp ? (
            <>
              <Separator />
              <PreferenceRow
                icon={Icons.MessageCircle}
                title="WhatsApp"
                subtitle={whatsappSubtitle}
                checked={prefs.whatsappEnabled}
                disabled={saving}
                onCheckedChange={(checked) => onChange('whatsappEnabled', checked)}
              />
            </>
          ) : null}
          {extraRows}
        </>
      )}
    </SurfaceCard>
  )
}
