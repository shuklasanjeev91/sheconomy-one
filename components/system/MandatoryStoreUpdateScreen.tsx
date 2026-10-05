import { useState } from 'react'
import { Platform, Pressable, Text as RNText } from 'react-native'
import { Text, YStack } from 'tamagui'

import { brandColors } from '~/config/brand-colors'
import { getBundleInfo } from '~/lib/updates/bundle-info'
import { openAppStore } from '~/lib/updates/open-store'
import {
  getAndroidPlayStoreUrl,
  getIosStoreUrl,
} from '~/lib/updates/remote-config'
import { useAppUi } from '~/lib/theme/useAppUi'

type MandatoryStoreUpdateScreenProps = {
  minimumSupportedVersion: string
  currentVersion: string
}

/** Blocker when the installed native binary is below the remote minimum. */
export function MandatoryStoreUpdateScreen({
  minimumSupportedVersion,
  currentVersion,
}: MandatoryStoreUpdateScreenProps) {
  const ui = useAppUi()
  const [openFailed, setOpenFailed] = useState(false)

  const storeUrl = Platform.OS === 'ios' ? getIosStoreUrl() : getAndroidPlayStoreUrl()
  const bundle = getBundleInfo()
  const bundleLabel = bundle.updateId ? bundle.updateId.slice(0, 8) : bundle.source

  async function handleOpenStore() {
    setOpenFailed(!(await openAppStore()))
  }

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={10000}
      backgroundColor={ui.surface as never}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$4"
    >
      <Text fontSize={22} fontWeight="700" color={ui.text as never} textAlign="center">
        Update required
      </Text>
      <Text
        fontSize={15}
        color={ui.textMuted as never}
        textAlign="center"
        maxWidth={420}
        lineHeight={22}
      >
        This version of SHEconomy ({currentVersion}) is no longer supported. Please install version{' '}
        {minimumSupportedVersion} or newer from the store to continue.
      </Text>
      {storeUrl ? (
        // Core Pressable, not the Tamagui Button: this renders inside a native
        // Modal, where Tamagui's gesture-handler presses never fire on Android.
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleOpenStore()}
          hitSlop={8}
          style={({ pressed }) => ({
            minWidth: 220,
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: pressed ? brandColors.primaryDark : brandColors.primary,
          })}
        >
          <RNText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
            {Platform.OS === 'ios' ? 'Open App Store' : 'Open Play Store'}
          </RNText>
        </Pressable>
      ) : null}
      {!storeUrl || openFailed ? (
        <Text fontSize={13} color={ui.textMuted as never} textAlign="center" selectable>
          Open the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} and update SHEconomy manually.
          {storeUrl ? `\n${storeUrl}` : ''}
        </Text>
      ) : null}
      <Text fontSize={11} color={ui.textMuted as never} opacity={0.6}>
        {bundle.runtimeVersion ?? '?'} · {bundleLabel}
      </Text>
    </YStack>
  )
}
