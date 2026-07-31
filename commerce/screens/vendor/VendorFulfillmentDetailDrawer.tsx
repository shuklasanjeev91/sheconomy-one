import { useMemo } from 'react'

import { Icons, Input, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { EnrichedFulfillment } from '~/lib/orders/fulfillment.type'
import {
  fulfillmentEventLabel,
  getFulfillmentProgress,
  getFulfillmentStatusDisplay,
  isOverdueFulfillment,
  outstandingQuantity,
} from '~/lib/orders/fulfillment.utils'
import { formatOrderDate } from '~/lib/orders/order.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  FulfillmentPriorityBadge,
  FulfillmentStatusBadge,
} from '~/commerce/components/vendor/FulfillmentStatusBadge'
import { toneStyle } from '~/commerce/components/vendor/StatusPill'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import {
  VendorDrawerRow,
  VendorDrawerSection,
  VendorDrawerShell,
  VendorDrawerTile,
} from '~/commerce/components/vendor/VendorDrawerShell'
import {
  getVendorFulfillmentActions,
  type VendorFulfillmentAction,
} from '~/commerce/components/vendor/vendor-fulfillment-actions'

type VendorFulfillmentDetailDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  fulfillment: EnrichedFulfillment | null
  loading: boolean
  submitting: boolean
  /** Tracking number entered for the "mark shipped" step. */
  tracking: string
  onTrackingChange: (value: string) => void
  /** Reason recorded on exception / cancellation / failed-delivery steps. */
  reason: string
  onReasonChange: (value: string) => void
  onClose: () => void
  onAction: (fulfillment: EnrichedFulfillment, action: VendorFulfillmentAction) => void
}

export function VendorFulfillmentDetailDrawer({
  ui,
  open,
  isDesktop,
  fulfillment,
  loading,
  submitting,
  tracking,
  onTrackingChange,
  reason,
  onReasonChange,
  onClose,
  onAction,
}: VendorFulfillmentDetailDrawerProps) {
  const actions = useMemo(
    () => (fulfillment ? getVendorFulfillmentActions(fulfillment) : []),
    [fulfillment],
  )
  // Newest first so the latest carrier scan is at the top of the timeline.
  const events = useMemo(
    () =>
      [...(fulfillment?.fulfillment_events ?? [])].sort((a, b) => {
        const aTime = a.event_timestamp ? new Date(a.event_timestamp).getTime() : 0
        const bTime = b.event_timestamp ? new Date(b.event_timestamp).getTime() : 0
        return bTime - aTime
      }),
    [fulfillment?.fulfillment_events],
  )

  if (!fulfillment) {
    return (
      <VendorDrawerShell
        ui={ui}
        open={open}
        isDesktop={isDesktop}
        icon={Icons.PackageCheck}
        title="Fulfilment"
        loading
        onClose={onClose}
      >
        {null}
      </VendorDrawerShell>
    )
  }

  const item = fulfillment.order_items
  const order = item?.orders
  const display = getFulfillmentStatusDisplay(fulfillment.fulfillment_status)
  const overdue = isOverdueFulfillment(fulfillment)
  const progress = getFulfillmentProgress(fulfillment.fulfillment_status)

  const promptBlocked = (action: VendorFulfillmentAction) =>
    (action.prompt === 'tracking' && tracking.trim().length === 0) ||
    (action.prompt === 'reason' && reason.trim().length === 0)

  const needsTracking = actions.some((action) => action.prompt === 'tracking')
  const needsReason = actions.some((action) => action.prompt === 'reason')

  return (
    <VendorDrawerShell
      ui={ui}
      open={open}
      isDesktop={isDesktop}
      icon={Icons.PackageCheck}
      title={fulfillment.fulfillment_number ?? 'Fulfilment'}
      subtitle={order?.order_number ? `Order #${order.order_number}` : null}
      loading={loading}
      onClose={onClose}
      footer={
        actions.length > 0 ? (
          <YStack gap="$2.5">
            {needsTracking ? (
              <YStack gap="$1.5">
                <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
                  TRACKING NUMBER
                </Text>
                <Input
                  value={tracking}
                  onChangeText={onTrackingChange}
                  placeholder="e.g. 1Z999AA10123456784"
                  autoCapitalize="characters"
                />
              </YStack>
            ) : null}
            {needsReason ? (
              <YStack gap="$1.5">
                <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
                  REASON
                </Text>
                <TextArea
                  value={reason}
                  onChangeText={onReasonChange}
                  numberOfLines={2}
                  placeholder="What went wrong?"
                />
              </YStack>
            ) : null}
            <YStack gap="$2">
              {actions.map((action) => (
                <YStack key={action.key} gap={2}>
                  <VendorActionButton
                    ui={ui}
                    action={action}
                    flex={1}
                    disabled={submitting || promptBlocked(action)}
                    onPress={() => onAction(fulfillment, action)}
                  />
                  <Text fontSize={11} color={ui.textMuted} paddingHorizontal="$2">
                    {promptBlocked(action)
                      ? action.prompt === 'tracking'
                        ? 'Add a tracking number to enable this.'
                        : 'Add a reason to enable this.'
                      : action.hint}
                  </Text>
                </YStack>
              ))}
            </YStack>
          </YStack>
        ) : (
          <Text fontSize={12.5} color={ui.textMuted} textAlign="center">
            This fulfilment is complete — nothing left to do.
          </Text>
        )
      }
    >
      {overdue ? (
        <XStack
          gap="$2"
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor={toneStyle('red').bg}
          alignItems="flex-start"
        >
          <Icons.Clock size={16} color={toneStyle('red').fg} />
          <Text fontSize={12.5} fontWeight="600" color={toneStyle('red').fg} flex={1}>
            Past the promised date — update the customer or flag an exception.
          </Text>
        </XStack>
      ) : null}

      <XStack gap="$2.5" flexWrap="wrap">
        <VendorDrawerTile ui={ui} label="Status">
          <FulfillmentStatusBadge status={fulfillment.fulfillment_status} size="sm" />
        </VendorDrawerTile>
        <VendorDrawerTile ui={ui} label="Priority">
          <FulfillmentPriorityBadge level={fulfillment.priority_level} />
        </VendorDrawerTile>
        <VendorDrawerTile ui={ui} label="Outstanding">
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {outstandingQuantity(fulfillment)} of {fulfillment.quantity_to_fulfill ?? 0}
          </Text>
        </VendorDrawerTile>
      </XStack>

      {/* Progress bar */}
      <YStack gap="$1.5">
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={11.5} fontWeight="700" color={ui.textMuted}>
            {display.description}
          </Text>
          <Text fontSize={11.5} fontWeight="700" color={ui.textSecondary}>
            {progress}%
          </Text>
        </XStack>
        <YStack height={6} borderRadius={999} backgroundColor={ui.surfaceMuted} overflow="hidden">
          <YStack
            width={`${progress}%`}
            height="100%"
            borderRadius={999}
            backgroundColor={toneStyle(display.tone).dot}
          />
        </YStack>
      </YStack>

      <VendorDrawerSection ui={ui} label="Item">
        <VendorDrawerRow ui={ui} label="Product" value={item?.product_title ?? 'Product'} />
        <VendorDrawerRow ui={ui} label="Ordered qty" value={String(item?.quantity ?? 1)} />
        <VendorDrawerRow ui={ui} label="Order" value={order?.order_number ?? '—'} />
        {order?.profiles?.full_name ? (
          <VendorDrawerRow ui={ui} label="Customer" value={order.profiles.full_name} />
        ) : null}
      </VendorDrawerSection>

      <VendorDrawerSection ui={ui} label="Shipment">
        <VendorDrawerRow
          ui={ui}
          label="Carrier"
          value={fulfillment.carrier_name ?? fulfillment.carrier_code ?? 'Not assigned'}
        />
        <VendorDrawerRow ui={ui} label="Tracking" value={fulfillment.tracking_number ?? '—'} />
        <VendorDrawerRow
          ui={ui}
          label="Est. ship"
          value={fulfillment.estimated_ship_date ? formatOrderDate(fulfillment.estimated_ship_date) : '—'}
        />
        <VendorDrawerRow
          ui={ui}
          label="Est. delivery"
          value={
            fulfillment.estimated_delivery_date
              ? formatOrderDate(fulfillment.estimated_delivery_date)
              : '—'
          }
        />
        {fulfillment.shipped_at ? (
          <VendorDrawerRow ui={ui} label="Shipped" value={formatOrderDate(fulfillment.shipped_at, true)} />
        ) : null}
        {fulfillment.delivered_at ? (
          <VendorDrawerRow
            ui={ui}
            label="Delivered"
            value={formatOrderDate(fulfillment.delivered_at, true)}
          />
        ) : null}
        {fulfillment.last_failure_reason ? (
          <Text fontSize={12} color={ui.danger} paddingTop="$1">
            Last failure: {fulfillment.last_failure_reason}
          </Text>
        ) : null}
      </VendorDrawerSection>

      {fulfillment.delivery_instructions || fulfillment.internal_notes ? (
        <VendorDrawerSection ui={ui} label="Notes">
          {fulfillment.delivery_instructions ? (
            <YStack gap={2}>
              <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                Delivery instructions
              </Text>
              <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
                {fulfillment.delivery_instructions}
              </Text>
            </YStack>
          ) : null}
          {fulfillment.internal_notes ? (
            <YStack gap={2}>
              <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                Internal note
              </Text>
              <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
                {fulfillment.internal_notes}
              </Text>
            </YStack>
          ) : null}
        </VendorDrawerSection>
      ) : null}

      <VendorDrawerSection ui={ui} label="History">
        {events.length === 0 ? (
          <Text fontSize={12.5} color={ui.textMuted}>
            No events recorded yet.
          </Text>
        ) : (
          <YStack gap="$3">
            {events.map((event, index) => (
              <XStack key={event.id} gap="$2.5" alignItems="flex-start">
                <YStack alignItems="center" gap={2} paddingTop={3}>
                  <YStack
                    width={9}
                    height={9}
                    borderRadius={999}
                    backgroundColor={index === 0 ? ui.brand : ui.borderSubtle}
                  />
                  {index < events.length - 1 ? (
                    <YStack width={1} flex={1} minHeight={22} backgroundColor={ui.borderSubtle} />
                  ) : null}
                </YStack>
                <YStack flex={1} minWidth={0} gap={1} paddingBottom="$1">
                  <Text fontSize={12.5} fontWeight="700" color={ui.text}>
                    {fulfillmentEventLabel(event.event_type)}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
                    {event.event_description}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {formatOrderDate(event.event_timestamp, true)}
                    {event.event_location ? ` · ${event.event_location}` : ''}
                  </Text>
                </YStack>
              </XStack>
            ))}
          </YStack>
        )}
      </VendorDrawerSection>
    </VendorDrawerShell>
  )
}
