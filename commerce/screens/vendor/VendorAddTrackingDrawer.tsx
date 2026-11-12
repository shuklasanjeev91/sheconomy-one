import { Platform } from 'react-native'

import {
  Button,
  Icons,
  Image,
  ScrollView,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { getShadowStyle, radius } from '~/config/tokens'
import { ViewportOverlay } from '~/components/layout/ViewportOverlay'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'
import { formatOrderAmount } from '~/lib/orders/order.utils'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import { vendorRoutes } from '~/lib/routes'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 440

/** Kept for call-site typing; manual AWB submit is no longer used. */
export type TrackingFormValues = {
  courier_slug: string
  tracking_number: string
  custom_tracking_url: string | null
  notify_customer: boolean
}

type VendorAddTrackingDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  item: VendorOrderItem | null
  submitting: boolean
  /** Outbound ship vs reverse return pickup. */
  mode?: 'outbound' | 'return'
  shopId?: string | null
  easyshipCreditBalance?: number | null
  easyshipCanAfford?: boolean
  easyshipSubmitting?: boolean
  onShipWithEasyship?: () => void
  onClose: () => void
  /** @deprecated Manual AWB is disabled — Easyship only. */
  onSubmit?: (values: TrackingFormValues) => void
}

export function VendorAddTrackingDrawer({
  ui,
  open,
  isDesktop,
  item,
  submitting,
  mode = 'outbound',
  easyshipCreditBalance,
  easyshipCanAfford,
  easyshipSubmitting,
  onShipWithEasyship,
  onClose,
}: VendorAddTrackingDrawerProps) {
  useLockBodyScroll(open && Boolean(item))

  if (!open || !item) return null

  const panelPositionStyle = overlayPanelStyle()
  const busy = submitting || Boolean(easyshipSubmitting)

  return (
    <ViewportOverlay>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        onPress={busy ? undefined : onClose}
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
        <EasyshipOnlyForm
          ui={ui}
          item={item}
          submitting={submitting}
          mode={mode}
          easyshipCreditBalance={easyshipCreditBalance}
          easyshipCanAfford={easyshipCanAfford}
          easyshipSubmitting={easyshipSubmitting}
          onShipWithEasyship={onShipWithEasyship}
          onClose={onClose}
        />
      </YStack>
    </ViewportOverlay>
  )
}

function EasyshipOnlyForm({
  ui,
  item,
  submitting,
  mode,
  easyshipCreditBalance,
  easyshipCanAfford,
  easyshipSubmitting,
  onShipWithEasyship,
  onClose,
}: {
  ui: AppUiTokens
  item: VendorOrderItem
  submitting: boolean
  mode: 'outbound' | 'return'
  easyshipCreditBalance?: number | null
  easyshipCanAfford?: boolean
  easyshipSubmitting?: boolean
  onShipWithEasyship?: () => void
  onClose: () => void
}) {
  const order = item.orders
  const { resolveCurrency } = useVendorCurrency()
  const currency = resolveCurrency(order?.currency)
  const customer = order?.profiles
  const busy = submitting || Boolean(easyshipSubmitting)

  return (
    <YStack flex={1} minHeight={0}>
      <XStack
        alignItems="flex-start"
        justifyContent="space-between"
        paddingHorizontal="$5"
        paddingVertical="$4"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor={ui.borderSubtle}
      >
        <YStack gap={4} flex={1} minWidth={0}>
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            {mode === 'return' ? 'Create return label' : 'Create shipping label'}
          </Text>
          <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
            Order #{order?.order_number ?? '—'} · Labels are created with your wallet only — manual AWB entry is not available.
          </Text>
        </YStack>
        <YStack
          width={34}
          height={34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.7 }}
          onPress={busy ? undefined : onClose}
        >
          <Icons.X size={20} color={ui.textSecondary} />
        </YStack>
      </XStack>

      <ScrollView
        flex={1}
        minHeight={0}
        showsVerticalScrollIndicator={false}
        style={
          Platform.OS === 'web'
            ? ({ overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flexBasis: 0 } as const)
            : undefined
        }
        contentContainerStyle={{ padding: 20, gap: 18 }}
      >
        <XStack
          gap="$3"
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          alignItems="center"
          style={getShadowStyle('sm')}
        >
          <YStack
            width={48}
            height={48}
            borderRadius={radius.chip}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            alignItems="center"
            justifyContent="center"
          >
            {item.listing?.main_image_url ? (
              <Image source={{ uri: item.listing.main_image_url }} width={48} height={48} resizeMode="cover" />
            ) : (
              <Icons.Package size={18} color={ui.textMuted} />
            )}
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13.5} fontWeight="700" color={ui.text} numberOfLines={1}>
              {item.product_title ?? item.listing?.title ?? 'Product'}
            </Text>
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {customer?.full_name ?? 'Customer'} · {formatOrderAmount(item.total_price, currency)}
            </Text>
          </YStack>
        </XStack>

        <YStack
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.brand}
          backgroundColor={ui.chip}
        >
          <XStack gap="$2" alignItems="center">
            <Icons.Truck size={18} color={ui.brand} />
            <Text fontSize={15} fontWeight="800" color={ui.text}>
              Shipping label
            </Text>
          </XStack>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            {mode === 'return'
              ? 'Create a reverse pickup label. Tracking syncs automatically after the label is purchased.'
              : 'Buy a shipping label — freight is auto-debited from your shipping wallet (0% platform commission).'}
          </Text>
          {easyshipCreditBalance != null ? (
            <Text
              fontSize={12}
              color={easyshipCanAfford === false ? ui.danger : ui.textMuted}
              fontWeight={easyshipCanAfford === false ? '600' : '400'}
            >
              Wallet {Number(easyshipCreditBalance).toFixed(2)}
              {easyshipCanAfford === false
                ? ' — add funds before buying a label (buyer FREE delivery still uses your wallet for carrier freight).'
                : ''}
            </Text>
          ) : null}
          {easyshipCanAfford === false ? (
            <AppLink href={vendorRoutes.wallet}>
              <Button tone="primary" size="$4" borderRadius={999}>
                Top up wallet
              </Button>
            </AppLink>
          ) : onShipWithEasyship ? (
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              disabled={busy}
              onPress={onShipWithEasyship}
            >
              {easyshipSubmitting
                ? 'Creating shipping label…'
                : mode === 'return'
                  ? 'Create return label'
                  : 'Create shipping label'}
            </Button>
          ) : (
            <Text fontSize={12} color={ui.danger} lineHeight={18}>
              Open this order from Orders to create the shipping label.
            </Text>
          )}
        </YStack>
      </ScrollView>

      <XStack
        gap="$2.5"
        justifyContent="flex-end"
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderTopWidth={1}
        borderTopColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Button tone="outline" size="$4" borderRadius={999} disabled={busy} onPress={onClose}>
          Close
        </Button>
      </XStack>
    </YStack>
  )
}
