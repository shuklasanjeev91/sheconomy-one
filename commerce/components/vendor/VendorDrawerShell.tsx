/**
 * Right-side detail drawer shell shared by the vendor console.
 *
 * Backdrop + panel are portaled to the viewport on web so they are not clipped
 * by the vendor page scroller (`position: fixed` inside a transformed overflow
 * host shrinks the dimmer and cuts the drawer off-screen).
 */

import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ViewportOverlay } from '~/components/layout/ViewportOverlay'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type IconType = (typeof Icons)[keyof typeof Icons]

const PANEL_WIDTH = 460

type VendorDrawerShellProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  /** Header icon + title. */
  icon?: IconType
  title: string
  subtitle?: string | null
  /** Shows a centred spinner instead of the body. */
  loading?: boolean
  onClose: () => void
  /** Sticky footer (usually the action buttons). */
  footer?: ReactNode
  children: ReactNode
}

export function VendorDrawerShell({
  ui,
  open,
  isDesktop,
  icon,
  title,
  subtitle,
  loading,
  onClose,
  footer,
  children,
}: VendorDrawerShellProps) {
  // Lock background scroll while open (web); no-op on native.
  useLockBodyScroll(open)

  if (!open) return null

  const Icon = icon ?? Icons.Package
  const panelPositionStyle = overlayPanelStyle()

  return (
    <ViewportOverlay>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        onPress={onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
      >
        <YStack flex={1} minHeight={0}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$5"
            paddingVertical="$4"
            borderBottomWidth={1}
            borderBottomColor={ui.borderSubtle}
            gap="$2"
          >
            <XStack alignItems="flex-start" gap="$2" flex={1} minWidth={0}>
              <Icon size={18} color={ui.brand} />
              <YStack flex={1} minWidth={0}>
                <Text fontSize={16} fontWeight="800" color={ui.text} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
            <YStack
              width={34}
              height={34}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceMuted }}
              pressStyle={{ opacity: 0.7 }}
              onPress={onClose}
            >
              <Icons.X size={20} color={ui.textSecondary} />
            </YStack>
          </XStack>

          {loading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Spinner size="large" />
            </YStack>
          ) : (
            <ScrollView
              flex={1}
              minHeight={0}
              showsVerticalScrollIndicator={false}
              style={
                Platform.OS === 'web'
                  ? ({
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      minHeight: 0,
                      flexBasis: 0,
                    } as const)
                  : undefined
              }
              contentContainerStyle={{ padding: 20, gap: 16 }}
            >
              {children}
            </ScrollView>
          )}

          {footer && !loading ? (
            <YStack
              padding="$4"
              gap="$2"
              borderTopWidth={1}
              borderTopColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              {footer}
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    </ViewportOverlay>
  )
}

/** Bordered card grouping a labelled block of drawer content. */
export function VendorDrawerSection({
  ui,
  label,
  children,
}: {
  ui: AppUiTokens
  label: string
  children: ReactNode
}) {
  return (
    <YStack
      gap="$2.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
        {label.toUpperCase()}
      </Text>
      {children}
    </YStack>
  )
}

/** Small metric tile used in the drawer's summary strip. */
export function VendorDrawerTile({
  ui,
  label,
  children,
}: {
  ui: AppUiTokens
  label: string
  children: ReactNode
}) {
  return (
    <YStack
      flex={1}
      minWidth={110}
      gap={4}
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={10.5} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
        {label.toUpperCase()}
      </Text>
      {children}
    </YStack>
  )
}

/** Label/value row for compact detail lists. */
export function VendorDrawerRow({
  ui,
  label,
  value,
}: {
  ui: AppUiTokens
  label: string
  value: string
}) {
  return (
    <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
      <Text fontSize={12.5} color={ui.textSecondary} flexShrink={0}>
        {label}
      </Text>
      <Text fontSize={12.5} fontWeight="700" color={ui.text} textAlign="right" flex={1}>
        {value}
      </Text>
    </XStack>
  )
}
