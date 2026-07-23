import { usePathname } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { Platform } from 'react-native'

import { AppSearchField } from '~/components/search'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { AppHeaderBackButton } from '~/components/navigation/AppHeaderBackButton'
import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { NavLogo } from '~/components/navigation/NavLogo'
import { SETTINGS_NAV, settingsSectionFromPath } from '~/components/settings/config'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAppBackNavigation } from '~/hooks/useAppBackNavigation'
import { useAppUi } from '~/lib/theme/useAppUi'
import { chromeSurfaceStyle } from '~/lib/theme/surfaces'

import { AppCenterNavTabs } from './AppCenterNavTabs'
import { AppMenuButton } from './AppMenuSheet'
import { getAppColors } from './config'

/** Collapse search/logo row after this scroll offset — tabs stay visible (LinkedIn-style). */
const SCROLL_TABS_ONLY_THRESHOLD = 36
/** Header layout animation is web-only — on native it lags every back/tab chrome change. */
const headerAnim = Platform.OS === 'web' ? ('quick' as const) : undefined

type AppMobileHeaderProps = {
  /** Compact detail chrome — back + search, no section tab row. */
  minimal?: boolean
}

/**
 * Mobile/tablet top bar (hidden on desktop).
 * At rest: logo/search + product tabs.
 * On scroll: product tabs only (except desktop, which keeps the full header).
 */
export function AppMobileHeader({ minimal = false }: AppMobileHeaderProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const pathname = usePathname()
  const { showBack } = useAppBackNavigation()
  const { scrollY } = useAppBarScroll()
  const { count: unreadNotifications } = useUnreadNotifications()

  const isSettings = pathname === '/settings' || pathname.startsWith('/settings/')
  const settingsTitle = settingsHeaderTitle(pathname)
  const showProductTabs = !minimal && !isSettings
  /** Scrolled feed roots: collapse chrome to tabs only. */
  const tabsOnly = showProductTabs && scrollY > SCROLL_TABS_ONLY_THRESHOLD
  const showChromeRow = !tabsOnly

  return (
    <YStack
      backgroundColor={colors.surface}
      borderBottomWidth={1}
      borderBottomColor={colors.borderSubtle}
      zIndex={200}
      width="100%"
      position={Platform.OS === 'web' ? 'sticky' : 'relative'}
      top={Platform.OS === 'web' ? 0 : undefined}
      $gtMd={{ display: 'none' }}
      style={chromeSurfaceStyle(ui)}
      animation={headerAnim}
    >
      {showChromeRow ? (
        <XStack
          paddingHorizontal="$3"
          paddingTop="$2.5"
          paddingBottom="$2"
          alignItems="center"
          gap="$2.5"
          style={{ minHeight: 56 }}
          animation={headerAnim}
        >
          <XStack flexShrink={0} alignItems="center">
            {showBack ? <AppHeaderBackButton /> : <NavLogo compact href={commerceRoutes.home} />}
          </XStack>

          {isSettings ? (
            <YStack flex={1} minWidth={0} justifyContent="center">
              <Text
                fontSize={17}
                fontWeight="700"
                color={colors.text}
                numberOfLines={1}
                letterSpacing={-0.2}
              >
                {settingsTitle}
              </Text>
            </YStack>
          ) : (
            <YStack flex={1} minWidth={0} justifyContent="center">
              <AppSearchField compact />
            </YStack>
          )}

          <XStack flexShrink={0} gap={8} alignItems="center">
            <AppMenuButton mode="sheet" size={38} />
            <HeaderIcon
              href={routes.notifications}
              icon={Icons.Bell}
              label="Notifications"
              badgeCount={unreadNotifications}
            />
          </XStack>
        </XStack>
      ) : null}

      {showProductTabs ? (
        <AppCenterNavTabs variant="mobile" compact={tabsOnly} />
      ) : null}
    </YStack>
  )
}

function settingsHeaderTitle(pathname: string): string {
  const section = settingsSectionFromPath(pathname)
  if (!section) return 'Settings'
  return SETTINGS_NAV.find((item) => item.id === section)?.label ?? 'Settings'
}

function HeaderIcon({
  href,
  onPress,
  icon: Icon,
  label,
  badgeCount,
}: {
  href?: import('one').Href
  onPress?: () => void
  icon: typeof Icons.Bell
  label: string
  badgeCount?: number
}) {
  const colors = getAppColors(useAppUi())

  const button = (
    <XStack
      width={38}
      height={38}
      borderRadius={999}
      backgroundColor={colors.chip}
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="visible"
      cursor="pointer"
      aria-label={label}
      {...(Platform.OS === 'web' ? { animation: 'quick' as const } : {})}
      hoverStyle={{ backgroundColor: colors.chipHover, scale: 1.04 }}
      pressStyle={{ opacity: 0.75, scale: 0.94 }}
      {...(onPress ? { onPress } : {})}
    >
      <Icon size={20} color={colors.text} />
      {badgeCount != null && badgeCount > 0 ? (
        <NavCountBadge count={badgeCount} size="sm" borderColor={colors.surface} />
      ) : null}
    </XStack>
  )

  if (href) {
    return (
      <AppLink href={href} asChild>
        {button}
      </AppLink>
    )
  }
  return button
}
