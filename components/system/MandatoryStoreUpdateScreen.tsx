import { Linking, Platform } from 'react-native'
import { Text, YStack } from 'tamagui'

import { Button } from '~/components/ui/Button'
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

  async function openStore() {
    const url =
      Platform.OS === 'ios' ? getIosStoreUrl() : getAndroidPlayStoreUrl()
    if (!url) return
    try {
      await Linking.openURL(url)
    } catch {
      // ignore — screen remains visible
    }
  }

  const storeReady =
    (Platform.OS === 'ios' && Boolean(getIosStoreUrl())) ||
    (Platform.OS === 'android' && Boolean(getAndroidPlayStoreUrl()))

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
      {storeReady ? (
        <Button tone="primary" onPress={() => void openStore()}>
          {Platform.OS === 'ios' ? 'Open App Store' : 'Open Play Store'}
        </Button>
      ) : (
        <Text fontSize={13} color={ui.textMuted as never} textAlign="center">
          Open the App Store or Play Store and update SHEconomy manually.
        </Text>
      )}
    </YStack>
  )
}
