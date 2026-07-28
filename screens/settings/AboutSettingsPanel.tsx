import { Platform } from 'react-native'

import { BRAND_BLUE } from '~/community/lib/constants'
import { AppLink } from '~/components/navigation/AppLink'
import { usePwaInstall } from '~/components/pwa/PwaBootstrap'
import { Icons, ListItem, Separator, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'
import { resetAppOnboardingSeen } from '~/lib/onboarding/first-launch'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  getAppDisplayName,
  getNativeAppVersion,
  getNativeBuildNumber,
} from '~/lib/updates/native-app-version'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'

export function AboutSettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const ai = useAiAssistOptional()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()
  const appName = getAppDisplayName()
  const version = getNativeAppVersion()
  const build = getNativeBuildNumber()
  const versionSubtitle =
    Platform.OS === 'android'
      ? `${appName} · versionName ${version} · versionCode ${build}`
      : `${appName} · Version ${version} · Build ${build}`

  return (
    <SettingsPanel title="About" description="Help, AI assist, and app version">
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <AppLink href={routes.help} asChild>
          <XStack
            alignItems="center"
            gap="$3"
            paddingHorizontal="$4"
            paddingVertical="$3.5"
            hoverStyle={{ backgroundColor: ui.navHover }}
            cursor="pointer"
          >
            <Icons.HelpCircle size={18} color={ui.brand} />
            <YStack flex={1} gap={2}>
              <Text fontSize={15} color={ui.text} fontWeight="600">
                Help & Support
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                FAQs and contact for Marketplace, Community, Chat, Class, Co-Work, and shops
              </Text>
            </YStack>
            <Icons.ChevronRight size={16} color={ui.textMuted} />
          </XStack>
        </AppLink>
        <Separator />
        <XStack
          alignItems="center"
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          hoverStyle={{ backgroundColor: ui.navHover }}
          cursor="pointer"
          onPress={() => ai?.openAssist()}
        >
          <Icons.Sparkles size={18} color={ui.brand} />
          <YStack flex={1} gap={2}>
            <Text fontSize={15} color={ui.text} fontWeight="600">
              Ask SHEconomy AI
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              Contextual tips for the tab you’re on
            </Text>
          </YStack>
          <Icons.ChevronRight size={16} color={ui.textMuted} />
        </XStack>
        {Platform.OS === 'web' ? (
          <>
            <Separator />
            <XStack
              alignItems="center"
              gap="$3"
              paddingHorizontal="$4"
              paddingVertical="$3.5"
              hoverStyle={canInstall ? { backgroundColor: ui.navHover } : undefined}
              cursor={canInstall ? 'pointer' : 'default'}
              opacity={canInstall || isInstalled ? 1 : 0.95}
              onPress={() => {
                if (canInstall) void promptInstall()
              }}
              accessibilityRole={canInstall ? 'button' : undefined}
              accessibilityLabel={
                isInstalled ? 'App installed' : canInstall ? 'Install SHEconomy' : 'Install on this device'
              }
            >
              <Icons.Download size={18} color={ui.brand} />
              <YStack flex={1} gap={2}>
                <Text fontSize={15} color={ui.text} fontWeight="600">
                  {isInstalled
                    ? 'Installed as app'
                    : canInstall
                      ? 'Install SHEconomy'
                      : 'Install on this device'}
                </Text>
                <Text fontSize={13} color={ui.textMuted}>
                  {isInstalled
                    ? 'Running in standalone mode on this device'
                    : canInstall
                      ? 'Add to your home screen for a faster, full-screen experience'
                      : 'Chrome/Edge: use the install icon in the address bar. iPhone/iPad: Share → Add to Home Screen.'}
                </Text>
              </YStack>
              {canInstall ? <Icons.ChevronRight size={16} color={ui.textMuted} /> : null}
            </XStack>
          </>
        ) : null}
        {Platform.OS !== 'web' ? (
          <>
            <Separator />
            <XStack
              alignItems="center"
              gap="$3"
              paddingHorizontal="$4"
              paddingVertical="$3.5"
              hoverStyle={{ backgroundColor: ui.navHover }}
              cursor="pointer"
              onPress={() => {
                void resetAppOnboardingSeen().then(() => {
                  toast.show('Welcome tour will show the next time you relaunch the app', {
                    tone: 'success',
                  })
                })
              }}
              accessibilityRole="button"
              accessibilityLabel="Replay welcome tour"
            >
              <Icons.Sparkles size={18} color={ui.brand} />
              <YStack flex={1} gap={2}>
                <Text fontSize={15} color={ui.text} fontWeight="600">
                  Replay welcome tour
                </Text>
                <Text fontSize={13} color={ui.textMuted}>
                  Show the first-launch intro again after you fully close and reopen the app
                </Text>
              </YStack>
              <Icons.ChevronRight size={16} color={ui.textMuted} />
            </XStack>
          </>
        ) : null}
        <Separator />
        <ListItem
          icon={<Icons.Info size={18} color={BRAND_BLUE} />}
          title="Version"
          subTitle={versionSubtitle}
        />
      </SurfaceCard>
    </SettingsPanel>
  )
}
