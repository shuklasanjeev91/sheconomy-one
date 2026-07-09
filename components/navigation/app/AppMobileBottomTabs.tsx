import { Link, usePathname } from 'one'
import { useMemo } from 'react'
import { Platform } from 'react-native'

import { Avatar, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { tabBarPositionStyle } from '~/lib/layout/styles'
import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { useCart } from '~/commerce/hooks/useCart'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { useCoWorkTheme } from '~/co-work/lib/theme'

import {
  getAppColors,
  buildMobileBottomTabs,
  getMobileBottomTabMiddleTabs,
  getMobileBottomTabSection,
  type AppMobileTabItem,
} from './config'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Modern floating bottom tab dock — Home + section tabs + You. */
export function AppMobileBottomTabs() {
  const pathname = usePathname()
  const { isAuthenticated, profile } = useProfile()
  const { tier } = useAccess()
  const { safeBottom } = useAppLayout()
  const { itemCount } = useCart()

  const ui = useAppUi()
  const { ui: coworkUi } = useCoWorkTheme()
  const appColors = getAppColors(ui)

  const tabs = useMemo((): AppMobileTabItem[] => {
    const section = getMobileBottomTabSection(pathname)
    if (!section) {
      return []
    }

    return buildMobileBottomTabs(section, getMobileBottomTabMiddleTabs(section), tier)
  }, [pathname, tier])

  const section = getMobileBottomTabSection(pathname)

  if (tabs.length === 0) {
    return null
  }

  const isCoWork = section === 'co-work'
  const activeColor = isCoWork ? coworkUi.brandLight : appColors.brand
  const inactiveColor = isCoWork ? coworkUi.textMuted : appColors.icon
  const surfaceColor = isCoWork ? coworkUi.controlsDock : appColors.surface
  const borderColor = isCoWork ? coworkUi.glassBorder : appColors.borderSubtle
  const activePillBg = isCoWork ? coworkUi.brandMuted : `${appColors.brand}16`

  return (
    <YStack
      zIndex={200}
      $gtMd={{ display: 'none' }}
      width="100%"
      pointerEvents="box-none"
      style={{
        ...tabBarPositionStyle(),
        paddingBottom: Math.max(10, safeBottom),
        paddingHorizontal: 12,
        paddingTop: 8,
      }}
    >
      <XStack
        width="100%"
        backgroundColor={surfaceColor}
        borderWidth={1}
        borderColor={borderColor}
        borderRadius={radius.surface}
        paddingHorizontal={6}
        paddingVertical={8}
        alignItems="center"
        justifyContent="space-between"
        style={{
          ...(Platform.OS === 'web'
            ? {
                backdropFilter: isCoWork ? undefined : 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: isCoWork ? undefined : 'blur(18px) saturate(160%)',
                boxShadow: isCoWork
                  ? '0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 10px 32px rgba(208, 16, 96, 0.12), 0 2px 8px rgba(16, 12, 14, 0.06)',
              }
            : getShadowStyle('md')),
        }}
      >
        {tabs.map((tab) => {
          const isAuthTab = tab.label === 'You'
          const isCartTab = tab.label === 'Cart'
          const isFocused = tab.match ? tab.match(pathname) : pathname === tab.href

          return (
            <Link key={`${tab.label}-${String(tab.href)}`} href={tab.href} asChild>
              <TabItem
                tab={tab}
                isFocused={isFocused}
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                activePillBg={activePillBg}
                showAvatar={isAuthTab && isAuthenticated}
                avatarName={profile?.full_name || profile?.username || 'You'}
                avatarSrc={profile?.avatar_url}
                badge={isCartTab ? itemCount : undefined}
                surfaceColor={surfaceColor}
              />
            </Link>
          )
        })}
      </XStack>
    </YStack>
  )
}

function TabItem({
  tab,
  isFocused,
  activeColor,
  inactiveColor,
  activePillBg,
  showAvatar,
  avatarName,
  avatarSrc,
  badge,
  surfaceColor,
  ...props
}: {
  tab: AppMobileTabItem
  isFocused: boolean
  activeColor: string
  inactiveColor: string
  activePillBg: string
  showAvatar?: boolean
  avatarName?: string
  avatarSrc?: string | null
  badge?: number
  surfaceColor: string
  [key: string]: unknown
}) {
  const Icon = tab.icon
  const compactLabel = tab.label.length > 8

  return (
    <YStack
      {...props}
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap={4}
      paddingVertical={2}
      cursor="pointer"
      pressStyle={{ opacity: 0.72, scale: 0.96 }}
      animation="quick"
      minWidth={0}
      position="relative"
    >
      {showAvatar ? (
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
            <Avatar name={avatarName} src={avatarSrc ?? undefined} size="$3" />
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
          position="relative"
          overflow="visible"
        >
          <Icon
            size={isFocused ? 22 : 21}
            color={isFocused ? activeColor : inactiveColor}
            fill={isFocused && tab.label !== 'Cart' && tab.label !== 'Saved' ? activeColor : 'none'}
            strokeWidth={isFocused ? 2.35 : 1.9}
          />
          {badge != null && badge > 0 ? (
            <NavCountBadge count={badge} size="sm" borderColor={surfaceColor} />
          ) : null}
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
        {tab.label}
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
