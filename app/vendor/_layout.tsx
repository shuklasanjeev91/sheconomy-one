import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Slot, useGlobalSearchParams, usePathname, useRouter } from 'one'

import { RequireVendorRole } from '~/components/auth/RouteGuard'
import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { edgePanelPositionStyle, overlayBackdropStyle } from '~/lib/layout/styles'
import { loadMyShops } from '~/lib/shop/shop.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { VendorSidebar } from '~/commerce/components/vendor/VendorSidebar'
import {
  getActiveVendorNavItem,
  resolveVendorActiveSubId,
  type VendorNavItem,
} from '~/commerce/components/vendor/vendor-nav'
import { commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

const EXPANDED_WIDTH = 268
const COLLAPSED_WIDTH = 80
const DRAWER_WIDTH = 300
const TOPBAR_HEIGHT = 60

export function VendorLayout() {
  const ui = useAppUi()
  // No `safeTop` here — AppShell already wraps routes in a top SafeAreaView.
  const { isDesktop, hasSideRails, safeBottom, desktopHeaderHeight } = useAppLayout()
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useAppDispatch()

  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const currentShop = useAppSelector((s) => s.shop.currentShop)
  const mobileTabPad =
    !isDesktop ? APP_LAYOUT.mobileTabBarHeight + Math.max(safeBottom, 8) : 0

  useEffect(() => {
    // Always refresh on entering the vendor area so `myShops`/`currentShop` are
    // reconciled for the signed-in user (a persisted cache can belong to a
    // previous account/session).
    void dispatch(loadMyShops(undefined))
  }, [dispatch])

  const active = getActiveVendorNavItem(pathname)
  const globalParams = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const activeSubId = resolveVendorActiveSubId(pathname, globalParams.section)

  function handleSelect(item: VendorNavItem) {
    setDrawerOpen(false)
    router.push(item.href)
  }

  const desktopHeight =
    Platform.OS === 'web' ? (`calc(100dvh - ${desktopHeaderHeight}px)` as const) : undefined

  return (
    <RequireVendorRole signInReturnTo="/vendor/myshop">
      <YStack
        width="100%"
        maxWidth="100%"
        backgroundColor={ui.background}
        flex={Platform.OS === 'web' ? undefined : 1}
        minHeight={Platform.OS === 'web' ? undefined : 0}
      >
        <XStack
          width="100%"
          alignItems="stretch"
          flex={Platform.OS === 'web' ? undefined : 1}
          minHeight={Platform.OS === 'web' ? undefined : 0}
          style={
            Platform.OS === 'web'
              ? ({ height: desktopHeight, minHeight: desktopHeight } as const)
              : undefined
          }
        >
          {/* Persistent sidebar wherever the page is wide enough for a rail */}
          {hasSideRails ? (
            <YStack
              width={collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}
              animation="quick"
              borderRightWidth={1}
              borderRightColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              height="100%"
              style={
                Platform.OS === 'web'
                  ? ({ position: 'sticky', top: desktopHeaderHeight } as const)
                  : undefined
              }
            >
              <VendorSidebar
                ui={ui}
                collapsed={collapsed}
                activeId={active.id}
                activeSubId={activeSubId}
                shopName={currentShop?.shop_name}
                shopLogo={currentShop?.logo_url}
                onSelect={handleSelect}
                onToggleCollapse={() => setCollapsed((value) => !value)}
              />
            </YStack>
          ) : null}

          {/* Main column */}
          <YStack flex={1} minWidth={0} minHeight={0}>
            {/* Compact top bar — the sidebar replaces its menu button when shown */}
            {!hasSideRails ? (
              <XStack
                minHeight={TOPBAR_HEIGHT}
                paddingHorizontal="$4"
                alignItems="center"
                gap="$3"
                backgroundColor={ui.surface}
                borderBottomWidth={1}
                borderBottomColor={ui.borderSubtle}
                style={getShadowStyle('sm')}
              >
                <YStack
                  width={40}
                  height={40}
                  borderRadius={radius.chip}
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  animation="quick"
                  hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => setDrawerOpen(true)}
                >
                  <Icons.Menu size={22} color={ui.text} />
                </YStack>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={16} fontWeight="800" color={ui.text} letterSpacing={-0.2} numberOfLines={1}>
                    {active.label}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted} fontWeight="500" numberOfLines={1}>
                    {currentShop?.shop_name?.trim() || 'Manage shop'}
                  </Text>
                </YStack>
                <YStack
                  width={40}
                  height={40}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.surfaceMuted}
                  cursor="pointer"
                  animation="quick"
                  hoverStyle={{ backgroundColor: ui.chip }}
                  pressStyle={{ opacity: 0.75, scale: 0.96 }}
                  onPress={() => navigateApp(commerceRoutes.home)}
                  accessibilityRole="button"
                  accessibilityLabel="Close manage shop and go to marketplace home"
                >
                  <Icons.X size={22} color={ui.text} />
                </YStack>
              </XStack>
            ) : null}

            {/* Content */}
            <ScrollView
              flex={1}
              width="100%"
              showsVerticalScrollIndicator={false}
              style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: mobileTabPad }}
            >
              <Slot />
            </ScrollView>
          </YStack>
        </XStack>

        {/* Slide-in drawer — only when there is no persistent sidebar */}
        {!hasSideRails && drawerOpen ? (
          <YStack key="vendor-drawer-layer" style={overlayBackdropStyle()} zIndex={300}>
            <YStack
              key="vendor-backdrop"
              fullscreen
              backgroundColor="rgba(0,0,0,0.5)"
              animation="quick"
              enterStyle={{ opacity: 0 }}
              onPress={() => setDrawerOpen(false)}
            />
            <YStack
              key="vendor-drawer"
              style={edgePanelPositionStyle()}
              width={Platform.OS === 'web' ? DRAWER_WIDTH : '100%'}
              maxWidth={Platform.OS === 'web' ? '85%' : '100%'}
              height="100%"
              backgroundColor={ui.surface}
              borderRightWidth={Platform.OS === 'web' ? 1 : 0}
              borderRightColor={ui.borderSubtle}
              zIndex={1}
              animation="quick"
              enterStyle={{ x: Platform.OS === 'web' ? -DRAWER_WIDTH : -40 }}
            >
              <YStack flex={1} minHeight={0}>
                <VendorSidebar
                  ui={ui}
                  collapsed={false}
                  activeId={active.id}
                  activeSubId={activeSubId}
                  shopName={currentShop?.shop_name}
                  shopLogo={currentShop?.logo_url}
                  onSelect={handleSelect}
                  onClose={() => setDrawerOpen(false)}
                />
              </YStack>
            </YStack>
          </YStack>
        ) : null}
      </YStack>
    </RequireVendorRole>
  )
}

export default function VendorLayoutRoute() {
  return <VendorLayout />
}
