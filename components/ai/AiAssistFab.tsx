import { Platform } from 'react-native'
import { usePathname } from 'one'

import { useComposerState } from '~/community/lib/composer-store'
import { Icons, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { isChatConversationPath, isChatPath, isCreatePostPath } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssist } from '~/providers/AiAssistProvider'

/** Space to clear ChatListPane’s “new message” FAB (58px) + gap. */
const CHAT_COMPOSE_FAB_CLEARANCE = 72

/**
 * Floating entry for signed-in AI assistant — shared web / iOS / Android.
 * Sits above the mobile tab bar and bottom-right on desktop.
 * On the chat inbox list it stacks above the compose FAB so the two don’t overlap.
 * Hidden while composing a post so it cannot cover the Post button.
 */
export function AiAssistFab() {
  const ui = useAppUi()
  const pathname = usePathname()
  const { openAssist, open } = useAiAssist()
  const { open: composerOpen } = useComposerState()
  const { isDesktop, mobileTabBarOffset, safeRight, safeBottom } = useAppLayout()

  if (open || composerOpen || isCreatePostPath(pathname ?? '')) return null

  // Mobile chat list also shows the PenSquare compose FAB at the same corner.
  const stackAboveChatCompose =
    !isDesktop && isChatPath(pathname) && !isChatConversationPath(pathname)

  const bottom =
    (isDesktop
      ? Math.max(safeBottom, 24)
      : Math.max(mobileTabBarOffset + 12, safeBottom + 12)) +
    (stackAboveChatCompose ? CHAT_COMPOSE_FAB_CLEARANCE : 0)
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
      role="button"
      aria-label="Ask SHEconomy AI"
      onPress={() => openAssist()}
    >
      <Icons.Sparkles size={22} color={ui.onBrand} />
    </YStack>
  )
}
