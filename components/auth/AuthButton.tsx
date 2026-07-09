import { Link, usePathname } from 'one'
import { useState, type ReactNode } from 'react'

import { AuthGuestMenuContent, AuthUserMenuContent } from '~/components/auth/AuthUserMenu'
import {
  Avatar,
  Icons,
  Popover,
  PopoverContent,
  Sheet,
  SheetFrame,
  SheetHandle,
  SheetOverlay,
  Text,
  XStack,
  YStack,
  useMedia,
} from '~/components/ui'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

type AuthButtonProps = {
  /** Header utility chip or bottom-tab dock item. */
  variant?: 'header' | 'tab'
  /** Tab dock visual state (variant="tab" only). */
  isFocused?: boolean
  activeColor?: string
  inactiveColor?: string
  activePillBg?: string
  surfaceColor?: string
  tabLabel?: string
}

/**
 * Cross-platform auth control — user icon + label when signed out, avatar when signed in.
 * Desktop: popover user menu. Mobile/tablet: bottom sheet.
 */
export function AuthButton({
  variant = 'header',
  isFocused = false,
  activeColor,
  inactiveColor,
  activePillBg = 'transparent',
  surfaceColor,
  tabLabel = 'You',
}: AuthButtonProps) {
  const ui = useAppUi()
  const media = useMedia()
  const pathname = usePathname()
  const { isAuthenticated, profile } = useProfile()
  const [menuOpen, setMenuOpen] = useState(false)

  const isDesktop = media.gtMd
  const signInHref = buildSignInUrl(pathname)
  const displayName = profile?.full_name || profile?.username || 'Account'

  const trigger =
    variant === 'tab' ? (
      <TabAuthTrigger
        isAuthenticated={isAuthenticated}
        isFocused={isFocused}
        displayName={displayName}
        avatarUrl={profile?.avatar_url}
        activeColor={activeColor ?? ui.brand}
        inactiveColor={inactiveColor ?? ui.icon}
        activePillBg={activePillBg}
        tabLabel={isAuthenticated ? tabLabel : 'Sign in'}
      />
    ) : (
      <HeaderAuthTrigger
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        avatarUrl={profile?.avatar_url}
        ui={ui}
      />
    )

  if (!isAuthenticated) {
    if (variant === 'tab') {
      return (
        <>
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            pressStyle={{ opacity: 0.72, scale: 0.96 }}
            onPress={() => setMenuOpen(true)}
          >
            {trigger}
          </YStack>
          <AuthSheet
            open={menuOpen}
            onOpenChange={setMenuOpen}
            title="Account"
          >
            <AuthGuestMenuContent onClose={() => setMenuOpen(false)} signInHref={signInHref} />
          </AuthSheet>
        </>
      )
    }

    return (
      <Link href={signInHref} asChild>
        <XStack cursor="pointer" pressStyle={{ opacity: 0.85 }}>
          {trigger}
        </XStack>
      </Link>
    )
  }

  if (isDesktop && variant === 'header') {
    return (
      <Popover open={menuOpen} onOpenChange={setMenuOpen} placement="bottom-end">
        <Popover.Trigger asChild>
          <XStack cursor="pointer" pressStyle={{ opacity: 0.85 }}>
            {trigger}
          </XStack>
        </Popover.Trigger>
        <PopoverContent padding="$3" minWidth={260}>
          <AuthUserMenuContent onClose={() => setMenuOpen(false)} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      <YStack
        flex={variant === 'tab' ? 1 : undefined}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.85, scale: variant === 'tab' ? 0.96 : 1 }}
        onPress={() => setMenuOpen(true)}
      >
        {trigger}
      </YStack>
      <AuthSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Account"
      >
        <AuthUserMenuContent onClose={() => setMenuOpen(false)} />
      </AuthSheet>
    </>
  )
}

function HeaderAuthTrigger({
  isAuthenticated,
  displayName,
  avatarUrl,
  ui,
}: {
  isAuthenticated: boolean
  displayName: string
  avatarUrl?: string | null
  ui: ReturnType<typeof useAppUi>
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
      >
        <Avatar name={displayName} src={avatarUrl ?? undefined} size="$3" />
      </YStack>
    )
  }

  return (
    <XStack
      height={40}
      paddingHorizontal="$3"
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
      <Text fontSize={13} fontWeight="700" color={ui.text}>
        Sign in
      </Text>
    </XStack>
  )
}

function TabAuthTrigger({
  isAuthenticated,
  isFocused,
  displayName,
  avatarUrl,
  activeColor,
  inactiveColor,
  activePillBg,
  tabLabel,
}: {
  isAuthenticated: boolean
  isFocused: boolean
  displayName: string
  avatarUrl?: string | null
  activeColor: string
  inactiveColor: string
  activePillBg: string
  tabLabel: string
}) {
  const compactLabel = tabLabel.length > 8

  return (
    <YStack alignItems="center" justifyContent="center" gap={4} paddingVertical={2} minWidth={0}>
      {isAuthenticated ? (
        <YStack
          width={40}
          height={32}
          alignItems="center"
          justifyContent="center"
          borderRadius={999}
          backgroundColor={isFocused ? activePillBg : 'transparent'}
        >
          <YStack
            borderWidth={isFocused ? 2 : 1.5}
            borderColor={isFocused ? activeColor : 'rgba(143,115,128,0.35)'}
            borderRadius={999}
            padding={1}
          >
            <Avatar name={displayName} src={avatarUrl ?? undefined} size="$3" />
          </YStack>
        </YStack>
      ) : (
        <XStack
          width={44}
          height={32}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={isFocused ? activePillBg : 'transparent'}
        >
          <Icons.User
            size={isFocused ? 22 : 21}
            color={isFocused ? activeColor : inactiveColor}
            strokeWidth={isFocused ? 2.35 : 1.9}
          />
        </XStack>
      )}

      <Text
        fontSize={compactLabel ? 9.5 : 10.5}
        fontWeight={isFocused ? '700' : '500'}
        color={isFocused ? activeColor : inactiveColor}
        numberOfLines={1}
        letterSpacing={0.1}
        textAlign="center"
        width="100%"
        opacity={isFocused ? 1 : 0.88}
      >
        {tabLabel}
      </Text>

      <YStack
        width={isFocused ? 14 : 0}
        height={3}
        borderRadius={999}
        backgroundColor={activeColor}
        opacity={isFocused ? 1 : 0}
        marginTop={1}
        animation="quick"
      />
    </YStack>
  )
}

function AuthSheet({
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
  const ui = useAppUi()

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal snapPointsMode="fit" dismissOnSnapToBottom>
      <SheetOverlay />
      <SheetFrame padding="$0" backgroundColor={ui.surface}>
        <YStack width="100%" gap="$3" paddingBottom="$4">
          <YStack paddingTop="$3" alignItems="center">
            <SheetHandle />
          </YStack>
          <XStack
            paddingHorizontal="$4"
            paddingBottom="$2"
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={1}
            borderBottomColor={ui.borderSubtle}
          >
            <Text fontSize={18} fontWeight="700" color={ui.text}>
              {title}
            </Text>
          </XStack>
          <YStack paddingHorizontal="$4" gap="$2">
            {children}
          </YStack>
        </YStack>
      </SheetFrame>
    </Sheet>
  )
}
