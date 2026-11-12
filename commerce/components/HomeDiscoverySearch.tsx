import { Platform } from 'react-native'

import { AppSearchField } from '~/components/search'
import { Text, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Marketplace home search strip — large search entry under the hero. */
export function HomeDiscoverySearch() {
  const ui = useAppUi()
  const { hasSideRails } = useAppLayout()

  return (
    <YStack
      width="100%"
      gap="$2"
      paddingVertical={hasSideRails ? '$2' : '$1'}
    >
      <Text
        fontSize={hasSideRails ? 15 : 13}
        fontWeight="600"
        color={ui.textSecondary}
        letterSpacing={-0.1}
      >
        Find something special
      </Text>
      <YStack
        width="100%"
        borderRadius={12}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        paddingHorizontal={hasSideRails ? '$2' : '$1.5'}
        paddingVertical={hasSideRails ? '$2' : '$1.5'}
        style={Platform.OS === 'web' ? getShadowStyle('sm') : undefined}
      >
        <AppSearchField />
      </YStack>
    </YStack>
  )
}
