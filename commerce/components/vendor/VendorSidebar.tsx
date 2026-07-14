import { Platform } from 'react-native'

import { Avatar, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { VENDOR_NAV_GROUPS, type VendorNavItem } from './vendor-nav'

const TOPBAR_HEIGHT = 60

type VendorSidebarProps = {
  ui: AppUiTokens
  collapsed: boolean
  activeId: string
  shopName?: string | null
  shopLogo?: string | null
  userName?: string | null
  userSubtitle?: string | null
  onSelect: (item: VendorNavItem) => void
  onToggleCollapse?: () => void
  onClose?: () => void
  onLogout?: () => void
}

export function VendorSidebar({
  ui,
  collapsed,
  activeId,
  shopName,
  shopLogo,
  userName,
  userSubtitle,
  onSelect,
  onToggleCollapse,
  onClose,
  onLogout,
}: VendorSidebarProps) {
  return (
    <YStack flex={1} minHeight={0}>
      {/* Brand header (shop identity) */}
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
          {shopLogo ? (
            <Avatar size="$4" src={shopLogo} name={shopName ?? 'Shop'} />
          ) : (
            <YStack
              width={38}
              height={38}
              borderRadius={radius.chip}
              backgroundColor={ui.brand}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Icons.Store size={20} color={ui.onBrand} />
            </YStack>
          )}
          {!collapsed ? (
            <YStack minWidth={0}>
              <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.3} numberOfLines={1}>
                {shopName || 'My Shop'}
              </Text>
              <Text fontSize={11} color={ui.textMuted} fontWeight="600" numberOfLines={1}>
                Vendor console
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
          {VENDOR_NAV_GROUPS.map((group) => (
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
                <VendorNavRow
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

      {/* Footer: user card + collapse + logout */}
      <YStack borderTopWidth={1} borderTopColor={ui.borderSubtle} padding={collapsed ? '$2' : '$3'} gap="$2">
        <XStack
          alignItems="center"
          gap="$2.5"
          padding="$2"
          borderRadius={radius.chip}
          justifyContent={collapsed ? 'center' : 'flex-start'}
        >
          <Avatar size="$3" name={userName ?? 'Vendor'} />
          {!collapsed ? (
            <YStack flex={1} minWidth={0}>
              <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                {userName || 'Vendor'}
              </Text>
              <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
                {userSubtitle || 'Signed in'}
              </Text>
            </YStack>
          ) : null}
        </XStack>

        {onLogout ? (
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
            pressStyle={{ opacity: 0.8 }}
            onPress={onLogout}
          >
            <Icons.LogOut size={18} color={ui.textSecondary} />
            {!collapsed ? (
              <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
                Log out
              </Text>
            ) : null}
          </XStack>
        ) : null}

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

type VendorNavRowProps = {
  ui: AppUiTokens
  item: VendorNavItem
  active: boolean
  collapsed: boolean
  onPress: () => void
}

function VendorNavRow({ ui, item, active, collapsed, onPress }: VendorNavRowProps) {
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
        <>
          <Text
            flex={1}
            fontSize={14}
            fontWeight={active ? '700' : '500'}
            color={active ? ui.onBrand : ui.text}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {!item.ready ? (
            <YStack
              paddingHorizontal={6}
              paddingVertical={1}
              borderRadius={999}
              backgroundColor={active ? 'rgba(255,255,255,0.22)' : ui.chip}
            >
              <Text fontSize={9} fontWeight="700" color={active ? ui.onBrand : ui.textMuted} letterSpacing={0.3}>
                SOON
              </Text>
            </YStack>
          ) : null}
        </>
      ) : null}
    </XStack>
  )
}
