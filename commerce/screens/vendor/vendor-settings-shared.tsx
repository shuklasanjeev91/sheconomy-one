import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export type IconType = (typeof Icons)[keyof typeof Icons]

/** White card wrapper used for every settings group. */
export function SettingsCard({ ui, children }: { ui: AppUiTokens; children: ReactNode }) {
  return (
    <YStack
      gap="$3.5"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      {children}
    </YStack>
  )
}

/** Icon chip + heading row at the top of a settings card. */
export function SettingsSectionTitle({
  ui,
  icon,
  title,
  noMargin,
}: {
  ui: AppUiTokens
  icon: IconType
  title: string
  noMargin?: boolean
}) {
  const Icon = icon
  return (
    <XStack alignItems="center" gap="$2" marginBottom={noMargin ? 0 : '$1'}>
      <YStack
        width={30}
        height={30}
        borderRadius={radius.chip}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} color={ui.brand} />
      </YStack>
      <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
        {title}
      </Text>
    </XStack>
  )
}

/** Sticky bottom action bar with the single Save button (all settings pages). */
export function SettingsSaveBar({
  ui,
  isDesktop,
  safeBottom,
  isSaving,
  onSave,
}: {
  ui: AppUiTokens
  isDesktop: boolean
  safeBottom: number
  isSaving: boolean
  onSave: () => void
}) {
  return (
    <XStack
      style={Platform.OS === 'web' ? ({ position: 'sticky', bottom: 0 } as const) : undefined}
      alignItems="center"
      justifyContent={isDesktop ? 'space-between' : 'flex-start'}
      gap="$3"
      flexWrap="wrap"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$3"
      paddingBottom={16 + (Platform.OS !== 'web' ? safeBottom : 0)}
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      zIndex={20}
    >
      {isDesktop ? (
        <Text fontSize={12} color={ui.textMuted}>
          Changes apply across your storefront instantly.
        </Text>
      ) : null}
      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        flex={isDesktop ? undefined : 1}
        disabled={isSaving}
        onPress={onSave}
        icon={isSaving ? <Spinner size="small" color="white" /> : <Icons.Check size={16} />}
      >
        {isSaving ? 'Saving…' : 'Save Changes'}
      </Button>
    </XStack>
  )
}
