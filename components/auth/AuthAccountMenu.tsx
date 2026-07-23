import type { Href } from 'one'
import { useMemo } from 'react'

import {
  getAccountMenuSections,
  getAccountQuickActions,
  getGuestAccountMenuSections,
  type AccountMenuItem,
  type AccountMenuSection,
  type AccountQuickAction,
} from '~/components/auth/accountMenu'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCart } from '~/commerce/hooks/useCart'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { navigateApp } from '~/lib/platform/navigate'
import { routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { useAuth } from '~/hooks/useAuth'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'

import { BRAND_NAME } from '~/config/brand'

type AuthUserMenuContentProps = {
  onClose: () => void
}

export function AuthUserMenuContent({ onClose }: AuthUserMenuContentProps) {
  const { profile } = useProfile()
  const { tier, isMale } = useAccess()
  const { signOut } = useAuth()
  const { shops } = useVendorShops()
  const { itemCount: cartCount } = useCart()
  const { favoriteIds } = useFavorites()
  const { isDesktop } = useAppLayout()
  const ai = useAiAssistOptional()

  const displayName = profile?.full_name || profile?.username || 'Your account'
  const profileHref = isMale
    ? routes.verifyGender
    : profile?.username
      ? routes.userProfile(profile.username)
      : routes.profile

  const quickActions = useMemo(
    () =>
      getAccountQuickActions({
        tier,
        cartCount,
        wishlistCount: favoriteIds.length,
        omitChromeDuplicates: !isDesktop,
      }),
    [tier, cartCount, favoriteIds.length, isDesktop],
  )

  const sections = useMemo(
    () =>
      getAccountMenuSections({
        tier,
        hasShops: shops.length > 0,
        primaryShopId: shops[0]?.id ?? null,
        omitChromeDuplicates: !isDesktop,
      }),
    [tier, shops, isDesktop],
  )

  function go(href: Href) {
    // Navigate first — closing a sheet/popover first can swallow the press.
    navigateApp(href)
    requestAnimationFrame(() => onClose())
  }

  return (
    <YStack gap="$4" width="100%">
      <ProfileHeaderCard
        displayName={displayName}
        username={profile?.username}
        email={profile?.email}
        avatarUrl={profile?.avatar_url}
        onPress={() => go(profileHref)}
      />

      <QuickActionsRow actions={quickActions} onNavigate={go} />

      {sections.map((section, index) => (
        <YStack key={section.id} gap="$1" width="100%">
          {index > 0 ? <SectionDivider /> : null}
          <AccountMenuSectionBlock
            section={section}
            onNavigate={go}
            onAction={(action) => {
              if (action === 'open-ai') {
                ai?.openAssist()
                requestAnimationFrame(() => onClose())
              }
            }}
          />
        </YStack>
      ))}

      <SectionDivider />

      <MenuRow
        icon={Icons.LogOut}
        label="Log out"
        description="Sign out of your account"
        tone="danger"
        onPress={() => {
          void signOut()
          onClose()
        }}
      />
    </YStack>
  )
}

function SectionDivider() {
  const ui = useAppUi()
  return <YStack height={1} backgroundColor={ui.borderSubtle} marginVertical="$1" />
}

function ProfileHeaderCard({
  displayName,
  username,
  email,
  avatarUrl,
  onPress,
}: {
  displayName: string
  username?: string | null
  email?: string | null
  avatarUrl?: string | null
  onPress: () => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$3"
      alignItems="center"
      padding="$3"
      borderRadius={12}
      cursor="pointer"
      backgroundColor={ui.chip}
      hoverStyle={{ backgroundColor: ui.chipHover }}
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <Avatar name={displayName} src={avatarUrl ?? undefined} size="$5" />
      <YStack flex={1} minWidth={0} gap={3}>
        <Text fontSize={16} fontWeight="800" color={ui.text} numberOfLines={1} letterSpacing={-0.2}>
          {displayName}
        </Text>
        {username ? (
          <Text fontSize={13} color={ui.textMuted} numberOfLines={1}>
            @{username}
          </Text>
        ) : email ? (
          <Text fontSize={13} color={ui.textMuted} numberOfLines={1}>
            {email}
          </Text>
        ) : (
          <Text fontSize={13} color={ui.textMuted}>
            View your profile
          </Text>
        )}
      </YStack>
      <Icons.ChevronRight size={18} color={ui.textMuted} />
    </XStack>
  )
}

function QuickActionsRow({
  actions,
  onNavigate,
}: {
  actions: AccountQuickAction[]
  onNavigate: (href: Href) => void
}) {
  const ui = useAppUi()

  return (
    <XStack gap="$2" width="100%" flexWrap="wrap">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <YStack
            key={action.id}
            flex={1}
            minWidth={72}
            maxWidth={96}
            alignItems="center"
            gap="$1.5"
            paddingVertical="$2"
            borderRadius={12}
            cursor="pointer"
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            hoverStyle={{ backgroundColor: ui.surfaceHover }}
            pressStyle={{ opacity: 0.9 }}
            onPress={() => onNavigate(action.href)}
          >
            <YStack position="relative">
              <Icon size={20} color={ui.text} />
              {action.badge != null && action.badge > 0 ? (
                <YStack
                  position="absolute"
                  top={-6}
                  right={-10}
                  minWidth={16}
                  height={16}
                  borderRadius={999}
                  paddingHorizontal={4}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.brand}
                >
                  <Text fontSize={9} fontWeight="800" color={ui.onBrand}>
                    {action.badge > 9 ? '9+' : action.badge}
                  </Text>
                </YStack>
              ) : null}
            </YStack>
            <Text fontSize={11} fontWeight="600" color={ui.text} textAlign="center">
              {action.label}
            </Text>
          </YStack>
        )
      })}
    </XStack>
  )
}

function AccountMenuSectionBlock({
  section,
  onNavigate,
  onAction,
}: {
  section: AccountMenuSection
  onNavigate: (href: Href) => void
  onAction?: (action: NonNullable<AccountMenuItem['action']>) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$1" width="100%">
      <YStack gap={2} paddingHorizontal="$2" paddingTop="$1">
        <Text
          fontSize={11}
          fontWeight="800"
          color={ui.textMuted}
          letterSpacing={0.7}
          textTransform="uppercase"
        >
          {section.title}
        </Text>
        {section.subtitle ? (
          <Text fontSize={12} color={ui.textMuted} lineHeight={16}>
            {section.subtitle}
          </Text>
        ) : null}
      </YStack>
      {section.items.map((menuItem) => (
        <MenuRow
          key={menuItem.id}
          icon={menuItem.icon}
          label={menuItem.label}
          description={menuItem.description}
          badge={menuItem.badge}
          onPress={() => {
            if (menuItem.action) {
              onAction?.(menuItem.action)
              return
            }
            onNavigate(menuItem.href)
          }}
        />
      ))}
    </YStack>
  )
}

function MenuRow({
  icon: Icon,
  label,
  description,
  onPress,
  tone = 'default',
  badge,
}: {
  icon: typeof Icons.User
  label: string
  description?: string
  onPress: () => void
  tone?: 'default' | 'danger'
  badge?: number
}) {
  const ui = useAppUi()
  const color = tone === 'danger' ? ui.danger : ui.text
  const iconColor = tone === 'danger' ? ui.danger : ui.textSecondary

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$2.5"
      paddingHorizontal="$2"
      borderRadius={10}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Icon size={20} color={iconColor} />
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={15} fontWeight="600" color={color} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text fontSize={12} color={ui.textMuted} numberOfLines={2} lineHeight={16}>
            {description}
          </Text>
        ) : null}
      </YStack>
      {badge != null && badge > 0 ? (
        <XStack
          minWidth={20}
          height={20}
          borderRadius={999}
          paddingHorizontal={6}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.brand}
        >
          <Text fontSize={11} fontWeight="700" color={ui.onBrand}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}

export function AuthGuestMenuContent({ onClose, signInHref }: { onClose: () => void; signInHref: Href }) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const sections = useMemo(
    () => getGuestAccountMenuSections({ omitChromeDuplicates: !isDesktop }),
    [isDesktop],
  )

  function preview() {
    navigateApp(signInHref)
    requestAnimationFrame(() => onClose())
  }

  return (
    <YStack gap="$4" paddingBottom="$2" width="100%">
      <YStack gap="$1.5" paddingHorizontal="$2">
        <Text fontSize={20} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
          Welcome to {BRAND_NAME}
        </Text>
        <Text fontSize={14} color={ui.textMuted} lineHeight={21}>
          Shop, sell, and connect with the {BRAND_NAME} community — all in one account.
        </Text>
      </YStack>

      {sections.map((section, index) => (
        <YStack key={section.id} gap="$1" width="100%">
          {index > 0 ? <SectionDivider /> : null}
          <YStack gap={2} paddingHorizontal="$2">
            <Text
              fontSize={11}
              fontWeight="800"
              color={ui.textMuted}
              letterSpacing={0.7}
              textTransform="uppercase"
            >
              {section.title}
            </Text>
            {section.subtitle ? (
              <Text fontSize={12} color={ui.textMuted}>
                {section.subtitle}
              </Text>
            ) : null}
          </YStack>
          {section.items.map((menuItem: AccountMenuItem) => (
            <MenuRow
              key={menuItem.id}
              icon={menuItem.icon}
              label={menuItem.label}
              description={menuItem.description}
              onPress={() =>
                section.id === 'shopping'
                  ? (navigateApp(menuItem.href), requestAnimationFrame(() => onClose()))
                  : preview()
              }
            />
          ))}
        </YStack>
      ))}

      <XStack
        height={48}
        borderRadius={999}
        backgroundColor={ui.brand}
        alignItems="center"
        justifyContent="center"
        marginHorizontal="$2"
        cursor="pointer"
        animation="quick"
        pressStyle={{ opacity: 0.9, scale: 0.98 }}
        role="button"
        accessibilityRole="button"
        accessibilityLabel="Sign in or create account"
        onPress={() => {
          // Navigate first, then close — closing the sheet before push can
          // cancel navigation when this CTA lives inside a modal portal.
          navigateApp(signInHref)
          requestAnimationFrame(() => onClose())
        }}
      >
        <Text fontSize={15} fontWeight="700" color={ui.onBrand}>
          Sign in or create account
        </Text>
      </XStack>
    </YStack>
  )
}
