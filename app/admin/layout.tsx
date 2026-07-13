import { useState } from 'react'
import { Platform } from 'react-native'
import { Redirect, Slot, usePathname, useRouter } from 'one'
import type { Href } from 'one'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { edgePanelPositionStyle, overlayBackdropStyle } from '~/lib/layout/styles'
import { useAppUi } from '~/lib/theme/useAppUi'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type IconType = (typeof Icons)[keyof typeof Icons]

type AdminNavItem = {
  id: string
  label: string
  description: string
  icon: IconType
  href: Href
}

type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

const NAV_GROUPS: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Key metrics and platform activity at a glance.',
        icon: Icons.LayoutDashboard,
        href: '/admin' as Href,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Traffic, conversion, and revenue trends.',
        icon: Icons.BarChart3,
        href: '/admin/analytics' as Href,
      },
    ],
  },
  {
    title: 'Management',
    items: [
      {
        id: 'users',
        label: 'Users',
        description: 'Manage members, roles, and verification.',
        icon: Icons.Users,
        href: '/admin/users' as Href,
      },
      {
        id: 'shops',
        label: 'Shops',
        description: 'Review and moderate seller storefronts.',
        icon: Icons.Store,
        href: '/admin/shops' as Href,
      },
      {
        id: 'products',
        label: 'Products',
        description: 'Catalog, listings, and inventory.',
        icon: Icons.Package,
        href: '/admin/products' as Href,
      },
      {
        id: 'orders',
        label: 'Orders',
        description: 'Track fulfilment and resolve disputes.',
        icon: Icons.ShoppingCart,
        href: '/admin/orders' as Href,
      },
      {
        id: 'payments',
        label: 'Payments',
        description: 'Payouts, refunds, and transactions.',
        icon: Icons.CreditCard,
        href: '/admin/payments' as Href,
      },
      {
        id: 'cart',
        label: 'Cart',
        description: 'Review carts, abandoned checkout activity, and cart issues.',
        icon: Icons.ShoppingCart,
        href: '/admin/cart' as Href,
      },
      {
        id: 'categories',
        label: 'Categories',
        description: 'Manage taxonomy, category pages, and merchandising groups.',
        icon: Icons.Package,
        href: '/admin/categories' as Href,
      },
      {
        id: 'sale-events',
        label: 'Sale Events',
        description: 'Plan promotional campaigns and sale collections.',
        icon: Icons.BarChart3,
        href: '/admin/sale-events' as Href,
      },
      {
        id: 'groups',
        label: 'Groups',
        description: 'Moderate community groups and group commerce activity.',
        icon: Icons.Users,
        href: '/admin/groups' as Href,
      },
    ],
  },
  {
    title: 'Content',
    items: [
      {
        id: 'company-pages',
        label: 'Company Pages',
        description: 'Manage brand, company, and community business pages.',
        icon: Icons.Store,
        href: '/admin/company-pages' as Href,
      },
      {
        id: 'cms',
        label: 'CMS',
        description: 'Edit platform content, landing pages, and editorial blocks.',
        icon: Icons.Settings,
        href: '/admin/cms' as Href,
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        id: 'moderation',
        label: 'Moderation',
        description: 'Reports, flags, and safety tools.',
        icon: Icons.ShieldCheck,
        href: '/admin/moderation' as Href,
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Platform configuration and preferences.',
        icon: Icons.Settings,
        href: '/admin/settings' as Href,
      },
    ],
  },
]

const NAV_ITEMS: AdminNavItem[] = NAV_GROUPS.flatMap((group) => group.items)

const EXPANDED_WIDTH = 268
const COLLAPSED_WIDTH = 80
const DRAWER_WIDTH = 300
const TOPBAR_HEIGHT = 60

function getActiveNavItem(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/admin'

  if (normalizedPath === '/admin') {
    return NAV_ITEMS[0]
  }

  return (
    NAV_ITEMS.find((item) => {
      const href = String(item.href).replace(/\/+$/, '')
      return href === '/admin' ? normalizedPath === href : normalizedPath === href || normalizedPath.startsWith(`${href}/`)
    }) ?? NAV_ITEMS[0]
  )
}

export function getAdminNavItem(id: string) {
  return NAV_ITEMS.find((item) => item.id === id) ?? NAV_ITEMS[0]
}

export function AdminLayout() {
  const ui = useAppUi()
  const { isDesktop, safeTop, safeBottom, desktopHeaderHeight } = useAppLayout()
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const active = getActiveNavItem(pathname)

  function handleSelect(item: AdminNavItem) {
    setDrawerOpen(false)
    router.push(item.href)
  }

  const desktopHeight =
    Platform.OS === 'web' ? (`calc(100dvh - ${desktopHeaderHeight}px)` as const) : undefined

  return (
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
        {/* Desktop persistent sidebar */}
        {isDesktop ? (
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
            <AdminSidebar
              ui={ui}
              collapsed={collapsed}
              activeId={active.id}
              onSelect={handleSelect}
              onToggleCollapse={() => setCollapsed((value) => !value)}
            />
          </YStack>
        ) : null}

        {/* Main column */}
        <YStack flex={1} minWidth={0} minHeight={0}>
          {/* Mobile top bar */}
          {!isDesktop ? (
            <XStack
              minHeight={TOPBAR_HEIGHT}
              paddingTop={Platform.OS !== 'web' ? safeTop : 0}
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
                  Admin console
                </Text>
              </YStack>
              <YStack
                width={40}
                height={40}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                animation="quick"
                hoverStyle={{ backgroundColor: ui.surfaceMuted }}
              >
                <Icons.Bell size={20} color={ui.textSecondary} />
              </YStack>
            </XStack>
          ) : null}

          {/* Content */}
          <ScrollView
            flex={1}
            width="100%"
            showsVerticalScrollIndicator={false}
            style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <Slot />
          </ScrollView>
        </YStack>
      </XStack>

      {/* Mobile slide-in drawer */}
      {!isDesktop && drawerOpen ? (
        <YStack key="admin-drawer-layer" style={overlayBackdropStyle()} zIndex={300}>
          <YStack
            key="admin-backdrop"
            fullscreen
            backgroundColor="rgba(0,0,0,0.5)"
            animation="quick"
            enterStyle={{ opacity: 0 }}
            onPress={() => setDrawerOpen(false)}
          />
          <YStack
            key="admin-drawer"
            style={edgePanelPositionStyle()}
            width={DRAWER_WIDTH}
            maxWidth="85%"
            height="100%"
            backgroundColor={ui.surface}
            borderRightWidth={1}
            borderRightColor={ui.borderSubtle}
            zIndex={1}
            animation="quick"
            enterStyle={{ x: -DRAWER_WIDTH }}
          >
            <YStack paddingTop={Platform.OS !== 'web' ? safeTop : 0} flex={1} minHeight={0}>
              <AdminSidebar
                ui={ui}
                collapsed={false}
                activeId={active.id}
                onSelect={handleSelect}
                onClose={() => setDrawerOpen(false)}
              />
            </YStack>
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}

export default function AdminLayoutRoute() {
  return <Redirect href="/admin" />
}

type AdminSidebarProps = {
  ui: AppUiTokens
  collapsed: boolean
  activeId: string
  onSelect: (item: AdminNavItem) => void
  onToggleCollapse?: () => void
  onClose?: () => void
}

function AdminSidebar({
  ui,
  collapsed,
  activeId,
  onSelect,
  onToggleCollapse,
  onClose,
}: AdminSidebarProps) {
  return (
    <YStack flex={1} minHeight={0}>
      {/* Brand header */}
      <XStack
        alignItems="center"
        justifyContent={collapsed ? 'center' : 'space-between'}
        gap="$2.5"
        paddingHorizontal={collapsed ? '$2' : '$4'}
        height={TOPBAR_HEIGHT}
        borderBottomWidth={1}
        borderBottomColor={ui.borderSubtle}
      >
        <XStack alignItems="center" gap="$2.5" minWidth={0}>
          <YStack
            width={38}
            height={38}
            borderRadius={radius.chip}
            backgroundColor={ui.brand}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icons.ShieldCheck size={20} color={ui.onBrand} />
          </YStack>
          {!collapsed ? (
            <YStack minWidth={0}>
              <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.3} numberOfLines={1}>
                Admin
              </Text>
              <Text fontSize={11} color={ui.textMuted} fontWeight="600" numberOfLines={1}>
                SHEconomy console
              </Text>
            </YStack>
          ) : null}
        </XStack>

        {onClose ? (
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            animation="quick"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={onClose}
          >
            <Icons.X size={20} color={ui.textSecondary} />
          </YStack>
        ) : null}
      </XStack>

      {/* Nav */}
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        <YStack gap="$4" paddingHorizontal={collapsed ? '$2' : '$3'}>
          {NAV_GROUPS.map((group) => (
            <YStack key={group.title} gap="$1">
              {!collapsed ? (
                <Text
                  fontSize={11}
                  fontWeight="700"
                  color={ui.textMuted}
                  letterSpacing={0.6}
                  textTransform="uppercase"
                  paddingHorizontal="$2"
                  paddingBottom="$1"
                >
                  {group.title}
                </Text>
              ) : null}
              {group.items.map((item) => (
                <AdminNavRow
                  key={item.id}
                  ui={ui}
                  item={item}
                  active={item.id === activeId}
                  collapsed={collapsed}
                  onPress={() => onSelect(item)}
                />
              ))}
            </YStack>
          ))}
        </YStack>
      </ScrollView>

      {/* Footer */}
      <YStack borderTopWidth={1} borderTopColor={ui.borderSubtle} padding={collapsed ? '$2' : '$3'} gap="$2">
        <XStack
          alignItems="center"
          gap="$2.5"
          padding="$2"
          borderRadius={radius.chip}
          justifyContent={collapsed ? 'center' : 'flex-start'}
        >
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icons.User size={18} color={ui.brand} />
          </YStack>
          {!collapsed ? (
            <YStack flex={1} minWidth={0}>
              <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                Administrator
              </Text>
              <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
                Signed in
              </Text>
            </YStack>
          ) : null}
        </XStack>

        {onToggleCollapse ? (
          <XStack
            alignItems="center"
            justifyContent={collapsed ? 'center' : 'flex-start'}
            gap="$2.5"
            paddingVertical="$2"
            paddingHorizontal={collapsed ? 0 : '$2'}
            borderRadius={radius.chip}
            cursor="pointer"
            animation="quick"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={onToggleCollapse}
          >
            {collapsed ? (
              <Icons.ChevronRight size={20} color={ui.textSecondary} />
            ) : (
              <>
                <Icons.ChevronLeft size={20} color={ui.textSecondary} />
                <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
                  Collapse
                </Text>
              </>
            )}
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  )
}

type AdminNavRowProps = {
  ui: AppUiTokens
  item: AdminNavItem
  active: boolean
  collapsed: boolean
  onPress: () => void
}

function AdminNavRow({ ui, item, active, collapsed, onPress }: AdminNavRowProps) {
  const Icon = item.icon ?? Icons.Circle

  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical="$2.5"
      paddingHorizontal={collapsed ? 0 : '$2'}
      justifyContent={collapsed ? 'center' : 'flex-start'}
      borderRadius={radius.chip}
      cursor="pointer"
      animation="quick"
      backgroundColor={active ? ui.brand : 'transparent'}
      hoverStyle={{ backgroundColor: active ? ui.brand : ui.surfaceMuted }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Icon size={20} color={active ? ui.onBrand : ui.textSecondary} />
      {!collapsed ? (
        <Text
          flex={1}
          fontSize={14}
          fontWeight={active ? '700' : '500'}
          color={active ? ui.onBrand : ui.text}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      ) : null}
    </XStack>
  )
}

type AdminContentProps = {
  ui: AppUiTokens
  active: AdminNavItem
  isDesktop: boolean
  safeBottom: number
}

export function AdminSectionPage({ sectionId }: { sectionId: string }) {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const active = getAdminNavItem(sectionId)

  return <AdminContent ui={ui} active={active} isDesktop={isDesktop} safeBottom={safeBottom} />
}

function AdminContent({ ui, active, isDesktop, safeBottom }: AdminContentProps) {
  const ActiveIcon = active.icon ?? Icons.Circle
  const stats = [
    { label: 'Total users', value: '12,480', delta: '+4.2%', icon: Icons.Users },
    { label: 'Active shops', value: '843', delta: '+1.8%', icon: Icons.Store },
    { label: 'Orders today', value: '1,204', delta: '+12%', icon: Icons.ShoppingCart },
    { label: 'Revenue (30d)', value: '₹8.2L', delta: '+6.5%', icon: Icons.CreditCard },
  ]

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      gap="$5"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      {/* Page header */}
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <YStack
            width={44}
            height={44}
            borderRadius={radius.card}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
          >
            <ActiveIcon size={22} color={ui.brand} />
          </YStack>
          <YStack flex={1} minWidth={0}>
            <Text fontSize={isDesktop ? 24 : 20} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              {active.label}
            </Text>
            <Text fontSize={14} color={ui.textSecondary} fontWeight="500">
              {active.description}
            </Text>
          </YStack>
        </XStack>
      </YStack>

      {/* Stat cards */}
      <XStack width="100%" flexWrap="wrap" gap="$3.5">
        {stats.map((stat) => {
          const StatIcon = stat.icon ?? Icons.Circle

          return (
            <YStack
              key={stat.label}
              flex={1}
              minWidth={isDesktop ? 220 : 150}
              gap="$2"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              style={getShadowStyle('sm')}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack
                  width={36}
                  height={36}
                  borderRadius={radius.chip}
                  backgroundColor={ui.roseSurface}
                  alignItems="center"
                  justifyContent="center"
                >
                  <StatIcon size={18} color={ui.brand} />
                </YStack>
                <XStack
                  alignItems="center"
                  gap={2}
                  paddingHorizontal={6}
                  paddingVertical={2}
                  borderRadius={999}
                  backgroundColor={ui.badgeSuccessBg}
                >
                  <Icons.TrendingUp size={11} color={ui.badgeSuccessText} />
                  <Text fontSize={11} fontWeight="700" color={ui.badgeSuccessText}>
                    {stat.delta}
                  </Text>
                </XStack>
              </XStack>
              <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.6}>
                {stat.value}
              </Text>
              <Text fontSize={13} color={ui.textMuted} fontWeight="500">
                {stat.label}
              </Text>
            </YStack>
          )
        })}
      </XStack>

      {/* Placeholder content panel */}
      <YStack
        width="100%"
        gap="$3"
        padding={isDesktop ? '$6' : '$5'}
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        alignItems="center"
        justifyContent="center"
        minHeight={240}
        style={getShadowStyle('sm')}
      >
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <ActiveIcon size={30} color={ui.textMuted} />
        </YStack>
        <YStack gap="$1" alignItems="center" maxWidth={420}>
          <Text fontSize={17} fontWeight="700" color={ui.text} textAlign="center">
            {active.label} content goes here
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            Hook this section up to your data and components. The responsive drawer layout is
            ready — switch sections from the {isDesktop ? 'sidebar' : 'menu'}.
          </Text>
        </YStack>
      </YStack>
    </YStack>
  )
}
