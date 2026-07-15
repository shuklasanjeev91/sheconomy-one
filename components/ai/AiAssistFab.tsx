import { Platform } from 'react-native'

import { Icons, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssist } from '~/providers/AiAssistProvider'

/**
 * Floating entry for signed-in AI assistant — shared web / iOS / Android.
 * Sits above the mobile tab bar and bottom-right on desktop.
 */
export function AiAssistFab() {
  const ui = useAppUi()
  const { openAssist, open } = useAiAssist()
  const { isDesktop, mobileTabBarOffset, safeRight, safeBottom } = useAppLayout()

  if (open) return null

  const bottom = isDesktop
    ? Math.max(safeBottom, 24)
    : Math.max(mobileTabBarOffset + 12, safeBottom + 12)
  const right = Math.max(safeRight, 16)

  return (
    <YStack
      // Fixed to the viewport on web so it doesn't scroll with page content.
      // Absolute on native (relative to the app shell, which doesn't window-scroll).
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      bottom={bottom}
      right={right}
      width={52}
      height={52}
      borderRadius={radius.pill}
      backgroundColor={ui.brand}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      zIndex={40}
      elevation={Platform.OS === 'android' ? 6 : undefined}
      shadowColor="#000"
      shadowOpacity={0.18}
      shadowRadius={10}
      shadowOffset={{ width: 0, height: 4 }}
      hoverStyle={{ opacity: 0.92 }}
      pressStyle={{ scale: 0.94, opacity: 0.9 }}
      animation="quick"
      aria-label="Ask SHEconomy AI"
      accessibilityRole="button"
      onPress={() => openAssist()}
    >
      <Icons.Sparkles size={22} color={ui.onBrand} />
    </YStack>
  )
}
