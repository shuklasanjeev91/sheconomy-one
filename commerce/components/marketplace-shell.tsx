/**
 * Marketplace cart / checkout / storefront shells — cross-platform (web, iOS, Android).
 * Uses SHEconomy brand colors with a soft marketplace layout rhythm.
 */
import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useCommercePalette } from '~/commerce/components/commerce-ui'

export function useMarketplaceShellPalette() {
  const c = useCommercePalette()
  const ui = useAppUi()
  return {
    ...c,
    /** Soft storefront page wash. */
    pageWash: ui.surfaceMuted,
    cardShadow: getShadowStyle('sm'),
  }
}

/** Full-width page canvas with soft wash background — edge-to-edge between gutters. */
export function MarketplacePage({
  children,
  paddingBottom,
  hasSideRails,
  /** Drop inset card chrome — stretch flush for PDP / full-bleed commerce pages. */
  flush = false,
}: {
  children: ReactNode
  paddingBottom?: number
  hasSideRails: boolean
  flush?: boolean
}) {
  const e = useMarketplaceShellPalette()
  return (
    <YStack
      width="100%"
      maxWidth="100%"
      alignSelf="stretch"
      gap={hasSideRails ? '$5' : '$4'}
      backgroundColor={e.pageWash}
      padding={flush ? 0 : hasSideRails ? '$5' : '$3'}
      // Mobile flush still needs side gutters; desktop flush relies on PageSection.
      paddingHorizontal={flush ? (hasSideRails ? 0 : '$3') : undefined}
      borderRadius={flush || !hasSideRails ? 0 : 12}
      paddingBottom={paddingBottom}
    >
      {children}
    </YStack>
  )
}

/** White content card with soft border + shadow. */
export function MarketplaceCard({
  children,
  gap = '$4',
  padding,
  hasSideRails = true,
}: {
  children: ReactNode
  gap?: string | number
  padding?: string | number
  hasSideRails?: boolean
}) {
  const e = useMarketplaceShellPalette()
  return (
    <YStack
      width="100%"
      backgroundColor={e.panel}
      borderWidth={1}
      borderColor={e.border}
      borderRadius={16}
      padding={(padding as never) ?? (hasSideRails ? '$5' : '$4')}
      gap={gap as never}
      style={Platform.OS === 'web' ? e.cardShadow : undefined}
      overflow="hidden"
    >
      {children}
    </YStack>
  )
}

/** Large page title — cart / checkout / account. */
export function MarketplacePageTitle({
  title,
  subtitle,
  hasSideRails,
}: {
  title: string
  subtitle?: string
  hasSideRails: boolean
}) {
  const e = useMarketplaceShellPalette()
  return (
    <YStack gap="$1.5" width="100%">
      <Text
        fontSize={hasSideRails ? 32 : 26}
        fontWeight="800"
        color={e.text}
        letterSpacing={-0.6}
        lineHeight={hasSideRails ? 38 : 32}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text fontSize={14} color={e.secondary} lineHeight={20}>
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  )
}

/** Section heading inside a marketplace page. */
export function MarketplaceSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const e = useMarketplaceShellPalette()
  return (
    <XStack width="100%" alignItems="flex-end" justifyContent="space-between" gap="$3">
      <YStack gap="$1" flex={1} minWidth={0}>
        <Text fontSize={22} fontWeight="800" color={e.text} letterSpacing={-0.4}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={13} color={e.secondary} lineHeight={18}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {action}
    </XStack>
  )
}

/** Shop group header (Sold by …). */
export function MarketplaceShopHeader({
  shopName,
  deliveryLabel,
}: {
  shopName: string
  deliveryLabel?: string
}) {
  const e = useMarketplaceShellPalette()
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      flexWrap="wrap"
      paddingBottom="$2"
      borderBottomWidth={1}
      borderBottomColor={e.divider}
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        <YStack
          width={28}
          height={28}
          borderRadius={999}
          backgroundColor={e.chip}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Store size={14} color={e.brand} />
        </YStack>
        <Text fontSize={15} color={e.text} fontWeight="700" numberOfLines={1} flex={1}>
          {shopName}
        </Text>
      </XStack>
      {deliveryLabel ? (
        <XStack alignItems="center" gap="$1.5">
          <Icons.Truck size={14} color={e.inStock} />
          <Text fontSize={12} color={e.inStock} fontWeight="600">
            {deliveryLabel}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}

/** Sticky order summary shell. */
export function MarketplaceSummaryCard({
  title = 'Order summary',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const e = useMarketplaceShellPalette()
  return (
    <YStack
      width="100%"
      backgroundColor={e.panel}
      borderWidth={1}
      borderColor={e.border}
      borderRadius={16}
      padding="$5"
      gap="$4"
      style={Platform.OS === 'web' ? e.cardShadow : undefined}
    >
      <Text fontSize={18} fontWeight="800" color={e.text} letterSpacing={-0.3}>
        {title}
      </Text>
      {children}
    </YStack>
  )
}

/** Numbered checkout step card. */
export function MarketplaceStepCard({
  step,
  title,
  children,
  complete,
}: {
  step: number
  title: string
  children: ReactNode
  complete?: boolean
}) {
  const e = useMarketplaceShellPalette()
  const ui = useAppUi()
  return (
    <YStack
      width="100%"
      backgroundColor={e.panel}
      borderWidth={1}
      borderColor={e.border}
      borderRadius={16}
      padding="$5"
      gap="$4"
      style={Platform.OS === 'web' ? e.cardShadow : undefined}
      flexShrink={0}
    >
      <XStack alignItems="center" gap="$3">
        <YStack
          width={28}
          height={28}
          borderRadius={999}
          backgroundColor={complete ? ui.success : ui.brand}
          alignItems="center"
          justifyContent="center"
        >
          {complete ? (
            <Icons.Check size={16} color={ui.onBrand} />
          ) : (
            <Text fontSize={13} fontWeight="800" color={ui.onBrand}>
              {step}
            </Text>
          )}
        </YStack>
        <Text fontSize={20} fontWeight="800" color={e.text} letterSpacing={-0.3} flex={1}>
          {title}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

/** Compact progress strip under checkout title. */
export function MarketplaceCheckoutProgress({
  steps,
  activeStep,
}: {
  steps: string[]
  activeStep: number
}) {
  const e = useMarketplaceShellPalette()
  const ui = useAppUi()
  return (
    <XStack width="100%" alignItems="center" gap="$2" flexWrap="wrap" paddingBottom="$1">
      {steps.map((label, index) => {
        const n = index + 1
        const active = n === activeStep
        const done = n < activeStep
        return (
          <XStack key={label} alignItems="center" gap="$2">
            {index > 0 ? (
              <YStack width={18} height={1} backgroundColor={e.border} />
            ) : null}
            <XStack
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$2.5"
              paddingVertical="$1.5"
              borderRadius={999}
              backgroundColor={active || done ? e.chip : 'transparent'}
            >
              <Text
                fontSize={12}
                fontWeight={active ? '800' : '600'}
                color={active || done ? ui.brand : e.muted}
              >
                {n}. {label}
              </Text>
            </XStack>
          </XStack>
        )
      })}
    </XStack>
  )
}

/** Primary marketplace CTA — slightly squared checkout / buy buttons. */
export function MarketplacePrimaryButton({
  children,
  onPress,
  disabled,
  width = '100%',
  height = 48,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  width?: number | string
  height?: number
}) {
  const ui = useAppUi()
  return (
    <XStack
      role="button"
      onPress={disabled ? undefined : onPress}
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.brand}
      borderRadius={8}
      height={height}
      width={width as never}
      paddingHorizontal="$4"
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      hoverStyle={disabled ? undefined : { backgroundColor: ui.brandDark }}
      pressStyle={disabled ? undefined : { opacity: 0.92 }}
      animation="quick"
    >
      <Text fontSize={16} color={ui.onBrand} fontWeight="800" numberOfLines={1}>
        {children}
      </Text>
    </XStack>
  )
}

/** Secondary outline CTA. */
export function MarketplaceSecondaryButton({
  children,
  onPress,
  disabled,
  width = '100%',
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  width?: number | string
}) {
  const e = useMarketplaceShellPalette()
  return (
    <XStack
      role="button"
      onPress={disabled ? undefined : onPress}
      alignItems="center"
      justifyContent="center"
      backgroundColor={e.panel}
      borderWidth={1}
      borderColor={e.border}
      borderRadius={8}
      height={44}
      width={width as never}
      paddingHorizontal="$4"
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      hoverStyle={disabled ? undefined : { backgroundColor: e.surfaceHover }}
      pressStyle={disabled ? undefined : { opacity: 0.92 }}
      animation="quick"
    >
      <Text fontSize={14} color={e.text} fontWeight="700" numberOfLines={1}>
        {children}
      </Text>
    </XStack>
  )
}

/** Trust line under CTAs. */
export function MarketplaceTrustNote({ children }: { children: string }) {
  const e = useMarketplaceShellPalette()
  return (
    <XStack alignItems="flex-start" gap="$2">
      <Icons.ShieldCheck size={14} color={e.secondary} />
      <Text fontSize={12} color={e.secondary} lineHeight={17} flex={1}>
        {children}
      </Text>
    </XStack>
  )
}

/** Empty-state panel for cart / favorites / orders. */
export function MarketplaceEmptyState({
  icon,
  title,
  subtitle,
  action,
  hasSideRails = true,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  action?: ReactNode
  hasSideRails?: boolean
}) {
  const e = useMarketplaceShellPalette()
  return (
    <MarketplaceCard hasSideRails={hasSideRails} padding="$8">
      <YStack alignItems="center" gap="$4" width="100%">
        {icon}
        <Text fontSize={22} fontWeight="800" color={e.text} textAlign="center">
          {title}
        </Text>
        <Text fontSize={14} color={e.secondary} textAlign="center" maxWidth={420} lineHeight={20}>
          {subtitle}
        </Text>
        {action}
      </YStack>
    </MarketplaceCard>
  )
}

/** PDP “From {shop}” link above the title. */
export function MarketplacePdpShopLink({
  shopName,
  onPress,
}: {
  shopName: string
  onPress?: () => void
}) {
  const e = useMarketplaceShellPalette()
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.85 } : undefined}
      alignSelf="flex-start"
    >
      <Text fontSize={14} color={e.secondary} fontWeight="500">
        From
      </Text>
      <Text
        fontSize={14}
        color={ui.brand}
        fontWeight="700"
        textDecorationLine="underline"
        textDecorationColor={ui.brand}
      >
        {shopName}
      </Text>
    </XStack>
  )
}

/** Large PDP listing title — always a single ellipsized line. */
export function MarketplacePdpTitle({
  children,
  hasSideRails = true,
}: {
  children: string
  hasSideRails?: boolean
}) {
  const e = useMarketplaceShellPalette()
  return (
    <Text
      fontSize={hasSideRails ? 22 : 18}
      fontWeight="700"
      color={e.text}
      letterSpacing={-0.35}
      lineHeight={hasSideRails ? 28 : 24}
      width="100%"
      maxWidth="100%"
      numberOfLines={1}
      ellipsizeMode="tail"
      style={
        Platform.OS === 'web'
          ? ({
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            } as const)
          : undefined
      }
    >
      {children}
    </Text>
  )
}

/** Buy-box card for desktop PDP — grows with content, never clips CTAs. */
export function MarketplaceBuyBox({
  children,
  gap = '$4',
}: {
  children: ReactNode
  gap?: string | number
}) {
  const e = useMarketplaceShellPalette()
  return (
    <YStack
      width="100%"
      backgroundColor={e.panel}
      borderWidth={1}
      borderColor={e.border}
      borderRadius={16}
      padding="$5"
      gap={gap as never}
      style={Platform.OS === 'web' ? e.cardShadow : undefined}
      flexShrink={0}
    >
      {children}
    </YStack>
  )
}

/** Soft section card under the PDP hero (details, reviews, policies). */
export function MarketplacePdpSection({
  title,
  subtitle,
  children,
  hasSideRails = true,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  hasSideRails?: boolean
}) {
  return (
    <MarketplaceCard hasSideRails={hasSideRails} gap="$4">
      <MarketplaceSectionTitle title={title} subtitle={subtitle} />
      {children}
    </MarketplaceCard>
  )
}
