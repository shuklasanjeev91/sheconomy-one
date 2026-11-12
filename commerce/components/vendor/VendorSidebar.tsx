import { useEffect, useState } from 'react'
import { usePathname } from 'one'

import { Avatar, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  VENDOR_NAV_GROUPS,
  getVendorSectionNavItemId,
  isVendorNavChildActive,
  isVendorNavItemActive,
  type VendorNavItem,
} from '~/commerce/components/vendor/vendor-nav'
import { useVendorActiveSubId } from '~/commerce/components/vendor/useVendorActiveSubId'

const TOPBAR_HEIGHT = 60

type VendorSidebarProps = {
  ui: AppUiTokens
  collapsed: boolean
  activeId: string
  activeSubId?: string
  shopName?: string | null
  shopLogo?: string | null
  onSelect: (item: VendorNavItem) => void
  onToggleCollapse?: () => void
  onClose?: () => void
}

export function VendorSidebar({
  ui,
  collapsed,
  activeId,
  activeSubId: activeSubIdProp,
  shopName,
  shopLogo,
  onSelect,
  onToggleCollapse,
  onClose,
}: VendorSidebarProps) {
  // The URL-derived id wins so the highlighted row stays in sync with
  // `?section=` changes that the router's params can lag behind on web.
  const urlActiveSubId = useVendorActiveSubId()
  const resolvedActiveSubId = urlActiveSubId ?? activeSubIdProp

  return (
    <YStack flex={1} minHeight={0}>
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

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
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
                <VendorNavEntry
                  key={item.id}
                  ui={ui}
                  item={item}
                  activeId={activeId}
                  activeSubId={resolvedActiveSubId}
                  collapsed={collapsed}
                  onSelect={onSelect}
                />
              ))}
            </YStack>
          ))}
        </YStack>
      </ScrollView>

      {onToggleCollapse ? (
        <YStack borderTopWidth={1} borderTopColor={ui.borderSubtle} padding={collapsed ? '$2' : '$3'}>
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
        </YStack>
      ) : null}
    </YStack>
  )
}

type VendorNavEntryProps = {
  ui: AppUiTokens
  item: VendorNavItem
  activeId: string
  activeSubId?: string
  collapsed: boolean
  onSelect: (item: VendorNavItem) => void
}

function VendorNavEntry({ ui, item, activeId, activeSubId, collapsed, onSelect }: VendorNavEntryProps) {
  const pathname = usePathname()
  const children = item.children ?? []
  const hasChildren = children.length > 0
  const groupActive = item.id === activeId || item.id === getVendorSectionNavItemId(pathname)
  const hasActiveChild = Boolean(
    activeSubId && children.some((child) => isVendorNavChildActive(child, activeSubId)),
  )
  const leafActive = isVendorNavItemActive(item, activeId, activeSubId, pathname)

  const [expanded, setExpanded] = useState(groupActive || hasActiveChild)
  useEffect(() => {
    if (groupActive || hasActiveChild) setExpanded(true)
  }, [groupActive, hasActiveChild])

  const showChildren = hasChildren && !collapsed && expanded

  if (!hasChildren || collapsed) {
    return (
      <VendorNavRow
        ui={ui}
        item={item}
        active={leafActive}
        collapsed={collapsed}
        onPress={() => onSelect(item)}
      />
    )
  }

  return (
    <YStack gap="$1">
      <VendorNavRow
        ui={ui}
        item={item}
        active={groupActive && !hasActiveChild}
        collapsed={collapsed}
        expandable
        expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
      />
      {showChildren ? (
        <YStack
          gap="$0.5"
          marginLeft="$4"
          paddingLeft="$2"
          borderLeftWidth={1}
          borderLeftColor={ui.borderSubtle}
        >
          {children.map((child) => (
            <VendorNavRow
              key={child.id}
              ui={ui}
              item={child}
              active={isVendorNavChildActive(child, activeSubId)}
              collapsed={false}
              isChild
              onPress={() => onSelect(child)}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}

type VendorNavRowProps = {
  ui: AppUiTokens
  item: VendorNavItem
  active: boolean
  collapsed: boolean
  isChild?: boolean
  expandable?: boolean
  expanded?: boolean
  onPress: () => void
}

function VendorNavRow({ ui, item, active, collapsed, isChild, expandable, expanded, onPress }: VendorNavRowProps) {
  const Icon = item.icon ?? Icons.Circle
  const iconSize = isChild ? 17 : 20

  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingVertical={isChild ? '$2' : '$2.5'}
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
      <Icon size={iconSize} color={active ? ui.onBrand : ui.textSecondary} />
      {!collapsed ? (
        <>
          <Text
            flex={1}
            fontSize={isChild ? 13.5 : 14}
            fontWeight={active ? '700' : isChild ? '500' : '500'}
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
          {expandable ? (
            <Icons.ChevronDown
              size={16}
              color={active ? ui.onBrand : ui.textMuted}
              style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
            />
          ) : null}
        </>
      ) : null}
    </XStack>
  )
}
