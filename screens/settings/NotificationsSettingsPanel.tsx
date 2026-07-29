import type { Href } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { pushPlatformLabel } from '~/components/settings/pushPlatformLabel'
import { useSettingsPushSync } from '~/components/settings/useSettingsPushSync'
import { radius } from '~/config/tokens'
import { REMINDER_FAMILIES } from '~/lib/notifications/reminder-catalog'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

function ReminderFamilyRow({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: Href
}) {
  const ui = useAppUi()
  return (
    <AppLink href={href} asChild>
      <XStack
        alignItems="center"
        gap="$3"
        paddingHorizontal="$4"
        paddingVertical="$3.5"
        hoverStyle={{ backgroundColor: ui.navHover }}
        cursor="pointer"
      >
        <Icons.Bell size={18} color={ui.textSecondary} />
        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontSize={15} color={ui.text} fontWeight="600">
            {title}
          </Text>
          <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
            {description}
          </Text>
        </YStack>
        <Icons.ChevronRight size={16} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}

export function NotificationsSettingsPanel() {
  const ui = useAppUi()
  const { pushConfigured, permissionGranted, pushBusy, syncDevicePush } = useSettingsPushSync()

  return (
    <SettingsPanel
      title="Notifications & reminders"
      description="Device push master switch, plus where each product’s reminders are configured. Works the same on web, iOS, and Android."
    >
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <PreferenceRow
          icon={Icons.Smartphone}
          title={`${pushPlatformLabel()} push`}
          subtitle={
            !pushConfigured
              ? 'Push is unavailable (OneSignal App ID missing from Supabase secrets). Confirm ONESIGNAL_APP_ID is set, then reopen the app — not Expo Go on iOS/Android'
              : permissionGranted
                ? 'Enabled for this browser — device registered for push delivery'
                : 'Turn on to get cart, order, meeting, stock, and event reminders'
          }
          checked={permissionGranted}
          disabled={pushBusy || !pushConfigured}
          onCheckedChange={(checked) => void syncDevicePush(checked)}
        />
      </SurfaceCard>

      <YStack gap="$2">
        <Text fontSize={13} fontWeight="700" color={ui.textSecondary} letterSpacing={0.4}>
          REMINDER TYPES
        </Text>
        <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
          {REMINDER_FAMILIES.map((family, index) => (
            <YStack key={family.id}>
              {index > 0 ? (
                <YStack height={1} backgroundColor={ui.borderSubtle} />
              ) : null}
              <ReminderFamilyRow
                title={family.title}
                description={family.description}
                href={appRoutes.settingsSection(family.settingsSection)}
              />
            </YStack>
          ))}
        </SurfaceCard>
      </YStack>
    </SettingsPanel>
  )
}
