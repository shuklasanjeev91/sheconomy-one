/**
 * Presentational building blocks shared by the vendor console panels
 * (orders / issues / fulfilments).
 *
 * These were extracted out of `VendorOrdersScreen` so every panel gets the same
 * header, toolbar, pagination, and empty-state treatment without copy-paste.
 * Everything here is pure presentation — no data fetching or store access.
 */

import { useState, type ReactNode } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Button, Icons, Popover, PopoverContent, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { commerceRoutes } from '~/lib/routes'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type IconType = (typeof Icons)[keyof typeof Icons]

// ============================================================================
// Layout shell
// ============================================================================

/** Outer padding/width wrapper every vendor panel sits inside. */
export function VendorPanelShell({
  isDesktop,
  safeBottom,
  children,
}: {
  isDesktop: boolean
  safeBottom: number
  children: ReactNode
}) {
  return (
    <YStack
      width="100%"
      maxWidth="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      {children}
    </YStack>
  )
}

/**
 * Card surface used for toolbars, tables, and grouped content. Tables pass
 * `padded={false}` so their rows sit flush against the card edges.
 */
export function VendorPanelCard({
  ui,
  children,
  padded = true,
}: {
  ui: AppUiTokens
  children: ReactNode
  padded?: boolean
}) {
  return (
    <YStack
      gap={padded ? '$3' : 0}
      padding={padded ? '$4' : 0}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      style={getShadowStyle('sm')}
    >
      {children}
    </YStack>
  )
}

// ============================================================================
// Header
// ============================================================================

export function VendorPanelHeader({
  ui,
  isDesktop,
  shopName,
  title,
  count,
  subtitle,
  onRefresh,
  refreshing,
  actions,
}: {
  ui: AppUiTokens
  isDesktop: boolean
  shopName?: string | null
  title: string
  /** Rendered next to the title as `(n)` when provided. */
  count?: number
  subtitle?: string | null
  onRefresh?: () => void
  refreshing?: boolean
  /** Extra buttons rendered next to Refresh. */
  actions?: ReactNode
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
      <YStack gap="$1" minWidth={0}>
        <XStack alignItems="center" gap="$1.5">
          <Icons.ShoppingBag size={14} color={ui.textMuted} />
          <Text fontSize={12} fontWeight="600" color={ui.textMuted} letterSpacing={0.2}>
            Vendor Console
          </Text>
          {shopName ? (
            <>
              <Icons.ChevronRight size={13} color={ui.textMuted} />
              <Text fontSize={12} fontWeight="700" color={ui.brand} numberOfLines={1}>
                {shopName}
              </Text>
            </>
          ) : null}
        </XStack>
        <XStack alignItems="center" gap="$2">
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            {title}
          </Text>
          {typeof count === 'number' ? (
            <Text fontSize={isDesktop ? 20 : 17} fontWeight="700" color={ui.textMuted}>
              ({count})
            </Text>
          ) : null}
        </XStack>
        {subtitle ? (
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>

      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        {actions}
        {onRefresh ? (
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.RefreshCw size={15} />}
            disabled={refreshing}
            onPress={onRefresh}
          >
            Refresh
          </Button>
        ) : null}
      </XStack>
    </XStack>
  )
}

// ============================================================================
// Section tabs (in-page navigation between panels)
// ============================================================================

export type VendorSectionTab = {
  id: string
  label: string
  icon: IconType
  href: string
  /** Attention count rendered as a badge on the tab. */
  badge?: number
}

/**
 * Horizontal tab row for switching between a page's `?section=` sub-pages.
 * The sidebar covers this on desktop, but on mobile it is behind a drawer, so
 * the tabs keep the sub-pages reachable in one tap.
 */
export function VendorSectionTabs({
  ui,
  tabs,
  activeId,
}: {
  ui: AppUiTokens
  tabs: VendorSectionTab[]
  activeId: string
}) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const Icon = tab.icon
        return (
          <AppLink key={tab.id} href={tab.href} asChild>
            <XStack
              alignItems="center"
              gap="$2"
              paddingHorizontal="$3.5"
              paddingVertical="$2"
              borderRadius={999}
              borderWidth={1}
              borderColor={active ? ui.brand : ui.borderSubtle}
              backgroundColor={active ? ui.brand : ui.surface}
              cursor="pointer"
              animation="quick"
              hoverStyle={{ borderColor: ui.brand }}
              pressStyle={{ opacity: 0.85 }}
            >
              <Icon size={16} color={active ? ui.onBrand : ui.textSecondary} />
              <Text fontSize={13} fontWeight={active ? '800' : '600'} color={active ? ui.onBrand : ui.text}>
                {tab.label}
              </Text>
              {tab.badge && tab.badge > 0 ? (
                <YStack
                  minWidth={20}
                  height={20}
                  paddingHorizontal={6}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={active ? 'rgba(255,255,255,0.24)' : ui.roseSurface}
                >
                  <Text fontSize={11} fontWeight="800" color={active ? ui.onBrand : ui.brand}>
                    {tab.badge}
                  </Text>
                </YStack>
              ) : null}
            </XStack>
          </AppLink>
        )
      })}
    </XStack>
  )
}

// ============================================================================
// Summary stats
// ============================================================================

export type VendorStat = {
  key: string
  label: string
  value: number
  icon: IconType
  /** Emphasise the tile when the value is non-zero and needs attention. */
  alert?: boolean
}

/** Compact metric strip above a queue (open / overdue / exceptions, etc.). */
export function VendorStatStrip({ ui, stats }: { ui: AppUiTokens; stats: VendorStat[] }) {
  return (
    <XStack gap="$3" flexWrap="wrap">
      {stats.map((stat) => {
        const highlight = Boolean(stat.alert) && stat.value > 0
        const Icon = stat.icon
        return (
          <XStack
            key={stat.key}
            flex={1}
            minWidth={140}
            alignItems="center"
            gap="$2.5"
            padding="$3"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={highlight ? ui.brand : ui.borderSubtle}
            backgroundColor={highlight ? ui.roseSurface : ui.surface}
          >
            <YStack
              width={34}
              height={34}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={highlight ? ui.brand : ui.surfaceMuted}
            >
              <Icon size={17} color={highlight ? ui.onBrand : ui.textSecondary} />
            </YStack>
            <YStack minWidth={0}>
              <Text fontSize={19} fontWeight="800" color={highlight ? ui.brand : ui.text}>
                {stat.value}
              </Text>
              <Text fontSize={11.5} fontWeight="600" color={ui.textMuted} numberOfLines={1}>
                {stat.label}
              </Text>
            </YStack>
          </XStack>
        )
      })}
    </XStack>
  )
}

// ============================================================================
// Toolbar controls
// ============================================================================

export function VendorFilterDropdown({
  ui,
  icon,
  label,
  options,
  value,
  onChange,
}: {
  ui: AppUiTokens
  icon: ReactNode
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          height={44}
          minWidth={150}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          cursor="pointer"
          hoverStyle={{ borderColor: ui.brand }}
          pressStyle={{ opacity: 0.8 }}
        >
          {icon}
          <Text flex={1} fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {label}
          </Text>
          <Icons.ChevronDown size={15} color={ui.textMuted} />
        </XStack>
      </Popover.Trigger>
      <PopoverContent>
        <YStack minWidth={190} gap={2}>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <XStack
                key={option.value}
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius={radius.chip}
                cursor="pointer"
                backgroundColor={selected ? ui.roseSurface : 'transparent'}
                hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Text fontSize={13} fontWeight={selected ? '800' : '600'} color={selected ? ui.brand : ui.text}>
                  {option.label}
                </Text>
                {selected ? <Icons.Check size={15} color={ui.brand} /> : null}
              </XStack>
            )
          })}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

export function VendorQuickChip({
  ui,
  label,
  count,
  active,
  onPress,
}: {
  ui: AppUiTokens
  label: string
  count?: number
  active: boolean
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.borderSubtle}
      backgroundColor={active ? ui.roseSurface : ui.surface}
      cursor="pointer"
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
    >
      <Text fontSize={12.5} fontWeight="700" color={active ? ui.brand : ui.textSecondary}>
        {label}
      </Text>
      {typeof count === 'number' && count > 0 ? (
        <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
          ({count})
        </Text>
      ) : null}
    </XStack>
  )
}

// ============================================================================
// Table + pagination
// ============================================================================

export function VendorTableHeaderCell({
  flex,
  label,
  align = 'flex-start',
}: {
  flex: number
  label: string
  align?: 'flex-start' | 'flex-end'
}) {
  return (
    <XStack flex={flex} justifyContent={align}>
      <Text fontSize={11} fontWeight="700" color="$color10" letterSpacing={0.3} textTransform="uppercase">
        {label}
      </Text>
    </XStack>
  )
}

export function VendorTableHeaderRow({ ui, children }: { ui: AppUiTokens; children: ReactNode }) {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={ui.surfaceMuted}
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      gap="$3"
    >
      {children}
    </XStack>
  )
}

function PagerButton({
  ui,
  icon,
  disabled,
  onPress,
}: {
  ui: AppUiTokens
  icon: IconType
  disabled?: boolean
  onPress: () => void
}) {
  const Icon = icon
  return (
    <YStack
      width={34}
      height={34}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.surface}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { borderColor: ui.brand }}
      pressStyle={disabled ? undefined : { opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      <Icon size={16} color={ui.textSecondary} />
    </YStack>
  )
}

/** "Showing 1 to 10 of 42 orders" + prev/next controls. */
export function VendorPager({
  ui,
  page,
  limit,
  total,
  totalPages,
  unitLabel,
  loading,
  onPageChange,
}: {
  ui: AppUiTokens
  page: number
  limit: number
  total: number
  totalPages: number
  /** Plural noun for the range copy, e.g. "orders". */
  unitLabel: string
  loading?: boolean
  onPageChange: (page: number) => void
}) {
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = Math.min(page * limit, total)

  return (
    <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$3" paddingTop="$1">
      <Text fontSize={12.5} color={ui.textMuted} fontWeight="600">
        Showing {rangeStart} to {rangeEnd} of {total} {unitLabel}
      </Text>
      <XStack alignItems="center" gap="$2">
        <PagerButton
          ui={ui}
          icon={Icons.ChevronLeft}
          disabled={page <= 1 || loading}
          onPress={() => onPageChange(Math.max(1, page - 1))}
        />
        <XStack
          minWidth={34}
          height={34}
          paddingHorizontal="$2"
          borderRadius={999}
          backgroundColor={ui.brand}
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={13} fontWeight="800" color={ui.onBrand}>
            {page}
          </Text>
        </XStack>
        <PagerButton
          ui={ui}
          icon={Icons.ChevronRight}
          disabled={page >= totalPages || loading}
          onPress={() => onPageChange(page + 1)}
        />
      </XStack>
    </XStack>
  )
}

// ============================================================================
// States
// ============================================================================

export function VendorEmptyState({
  ui,
  icon,
  title,
  description,
}: {
  ui: AppUiTokens
  icon: IconType
  title: string
  description: string
}) {
  const Icon = icon
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical={72} gap="$3">
      <YStack
        width={68}
        height={68}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
        {title}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {description}
      </Text>
    </YStack>
  )
}

export function VendorNoShopState({ ui }: { ui: AppUiTokens }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" minHeight={360}>
      <YStack
        width={68}
        height={68}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icons.Store size={30} color={ui.brand} />
      </YStack>
      <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
        No shop yet
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        Create your storefront to start receiving and managing orders.
      </Text>
      <AppLink href={commerceRoutes.manageShop()} asChild>
        <Button tone="primary" size="$4" borderRadius={999} marginTop="$2">
          Go to My Shops
        </Button>
      </AppLink>
    </YStack>
  )
}
