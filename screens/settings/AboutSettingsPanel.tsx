import { Platform } from 'react-native'

import { BRAND_BLUE } from '~/community/lib/constants'
import { AppLink } from '~/components/navigation/AppLink'
import { Icons, ListItem, Separator, Text, XStack, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'
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
  const ai = useAiAssistOptional()
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
