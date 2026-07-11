import { usePathname } from 'one'
import { useState, type ReactNode } from 'react'

import {
  AuthGuestMenuContent,
  AuthUserMenuContent,
} from '~/components/auth/AuthAccountMenu'
import { MobileTabBarItem } from '~/components/navigation/app/MobileTabBarItem'
import {
  Avatar,
  AppBottomSheet,
  Icons,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

type AuthAccountButtonProps = {
  variant?: 'header' | 'tab'
  /** Icon-only header chip on narrow screens. */
  compact?: boolean
  isFocused?: boolean
  activeColor?: string
  inactiveColor?: string
  activePillBg?: string
  surfaceColor?: string
  tabLabel?: string
  showTabLabel?: boolean
}

/**
 * Cross-platform account control — sign-in chip or avatar menu.
 * Header + tab: bottom sheet account drawer on all platforms.
 */
export function AuthAccountButton({
  variant = 'header',
  compact = false,
  isFocused = false,
  activeColor,
  inactiveColor,
  activePillBg = 'transparent',
  surfaceColor,
  tabLabel = 'You',
  showTabLabel = true,
}: AuthAccountButtonProps) {
  const ui = useAppUi()
  const pathname = usePathname()
  const { isAuthenticated, profile } = useProfile()
  const [menuOpen, setMenuOpen] = useState(false)

  const signInHref = buildSignInUrl(pathname)
  const displayName = profile?.full_name || profile?.username || 'Account'

  const trigger =
    variant === 'tab' ? (
      <MobileTabBarItem
        flex={1}
        minWidth={0}
        width="100%"
        alignSelf="stretch"
        label={isAuthenticated ? tabLabel : 'Sign in'}
        showLabel={showTabLabel}
        isFocused={isFocused}
        activeColor={activeColor ?? ui.brand}
        inactiveColor={inactiveColor ?? ui.icon}
        activePillBg={activePillBg}
        badgeBorderColor={surfaceColor}
        onPress={() => setMenuOpen(true)}
        accessibilityLabel={isAuthenticated ? 'Account menu' : 'Sign in'}
      >
        {isAuthenticated ? (
          <YStack
            borderWidth={isFocused ? 2 : 1.5}
            borderColor={isFocused ? (activeColor ?? ui.brand) : 'rgba(143,115,128,0.35)'}
            borderRadius={999}
            padding={1}
          >
            <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$2.5" />
          </YStack>
        ) : (
          <Icons.User
            size={isFocused ? 24 : 22}
            color={isFocused ? (activeColor ?? ui.brand) : (inactiveColor ?? ui.icon)}
            strokeWidth={isFocused ? 2.4 : 1.85}
          />
        )}
      </MobileTabBarItem>
    ) : (
      <HeaderTrigger
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        avatarUrl={profile?.avatar_url}
        ui={ui}
        compact={compact}
      />
    )

  const menuContent = isAuthenticated ? (
    <AuthUserMenuContent onClose={() => setMenuOpen(false)} />
  ) : (
    <AuthGuestMenuContent onClose={() => setMenuOpen(false)} signInHref={signInHref} />
  )

  if (variant === 'header') {
    return (
      <>
        <XStack
          cursor="pointer"
          pressStyle={{ opacity: 0.85 }}
          animation="quick"
          onPress={() => setMenuOpen(true)}
          aria-label={isAuthenticated ? 'Account menu' : 'Sign in'}
          accessibilityRole="button"
        >
          {trigger}
        </XStack>
        <AccountSheet open={menuOpen} onOpenChange={setMenuOpen} title="Account">
          {menuContent}
        </AccountSheet>
      </>
    )
  }

  return (
    <YStack flex={1} minWidth={0} width="100%" alignSelf="stretch">
      {trigger}
      <AccountSheet open={menuOpen} onOpenChange={setMenuOpen} title="Account">
        {menuContent}
      </AccountSheet>
    </YStack>
  )
}

/** @deprecated Use AuthAccountButton */
export const AuthButton = AuthAccountButton

function HeaderTrigger({
  isAuthenticated,
  displayName,
  avatarUrl,
  ui,
  compact = false,
}: {
  isAuthenticated: boolean
  displayName: string
  avatarUrl?: string | null
  ui: ReturnType<typeof useAppUi>
  compact?: boolean
}) {
  if (isAuthenticated) {
    return (
      <YStack
        width={40}
        height={40}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        borderWidth={1.5}
        borderColor={ui.borderSubtle}
        hoverStyle={{ borderColor: ui.brand }}
        pointerEvents="none"
      >
        <Avatar name={displayName} src={avatarUrl ?? undefined} size="$3" />
      </YStack>
    )
  }

  return (
    <XStack
      width={compact ? 38 : undefined}
      height={40}
      paddingHorizontal={compact ? 0 : '$3'}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceHover}
      alignItems="center"
      justifyContent="center"
      gap="$2"
      hoverStyle={{ backgroundColor: ui.chipHover }}
      aria-label={`Sign in to ${BRAND_NAME}`}
    >
      <Icons.CircleUser size={20} color={ui.text} />
      {compact ? null : (
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          Sign in
        </Text>
      )}
    </XStack>
  )
}

function AccountSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title} scrollable>
      {children}
    </AppBottomSheet>
  )
}
