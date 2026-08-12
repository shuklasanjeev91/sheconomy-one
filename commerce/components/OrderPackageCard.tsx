import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CommercePanel } from '~/commerce/components/CommercePanel'
import type { CustomerOrderPackage } from '~/commerce/lib/customer-orders'
import {
  deliveryNoteFromMetadata,
  formatEstimatedDelivery,
} from '~/commerce/lib/customer-order-lifecycle'
import { DELIVERY_STATUS_DISPLAY, DELIVERY_STATUS_PROGRESS, type DeliveryStatus } from '~/lib/orders/order.constants'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { useAppUi } from '~/lib/theme/useAppUi'

type OrderPackageCardProps = {
  shipment: CustomerOrderPackage
  index?: number
  /** Render inside a parent panel without an extra card wrapper. */
  embedded?: boolean
}

export function OrderPackageCard({ shipment, index = 0, embedded = false }: OrderPackageCardProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const statusDisplay =
    DELIVERY_STATUS_DISPLAY[shipment.delivery_status as DeliveryStatus] ?? null
  const progress =
    DELIVERY_STATUS_PROGRESS[shipment.delivery_status as DeliveryStatus] ?? 0
  const note = deliveryNoteFromMetadata(shipment.delivery_metadata)
  const eta = formatEstimatedDelivery(shipment.estimated_delivery_date)

  async function handleTrack() {
    if (!shipment.carrier_tracking_url) {
      toast.show('No carrier link yet', {
        tone: 'info',
        message: 'Tracking will appear once the shop adds a carrier URL.',
      })
      return
    }
    const opened = await openExternalUrl(shipment.carrier_tracking_url)
    if (!opened) {
      toast.show('Could not open tracking link', { tone: 'danger' })
    }
  }

  const body = (
    <>
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
        <YStack flex={1} gap={2}>
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            Package {index + 1}
            {shipment.product_title ? ` · ${shipment.product_title}` : ''}
          </Text>
          <Text fontSize={12} color={ui.textSecondary}>
            {statusDisplay?.label ?? shipment.delivery_status.replace(/_/g, ' ')}
            {shipment.carrier_name ? ` · ${shipment.carrier_name}` : ''}
          </Text>
        </YStack>
      </XStack>

      {shipment.tracking_number ? (
        <XStack alignItems="center" gap="$2">
          <Icons.Hash size={14} color={ui.textMuted} />
          <Text fontSize={13} color={ui.text} fontWeight="600">
            {shipment.tracking_number}
          </Text>
        </XStack>
      ) : (
        <Text fontSize={12} color={ui.textMuted}>
          Tracking number pending
        </Text>
      )}

      {progress > 0 ? (
        <YStack gap={6}>
          <XStack
            height={6}
            borderRadius={999}
            backgroundColor={ui.surfaceMuted}
            overflow="hidden"
            width="100%"
          >
            <YStack
              height="100%"
              width={`${Math.max(4, Math.min(100, progress))}%`}
              backgroundColor={ui.brand}
              borderRadius={999}
            />
          </XStack>
          <Text fontSize={11} color={ui.textMuted}>
            {progress}% · {statusDisplay?.description ?? 'Shipment update'}
          </Text>
        </YStack>
      ) : null}

      {eta ? (
        <Text fontSize={12} color={ui.textSecondary}>
          Estimated delivery: {eta}
        </Text>
      ) : null}

      {note ? (
        <Text fontSize={12} color={ui.textMuted}>
          {note}
        </Text>
      ) : null}

      {shipment.carrier_tracking_url ? (
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.ExternalLink size={14} />}
          onPress={() => void handleTrack()}
          alignSelf="flex-start"
        >
          Track with carrier
        </Button>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <YStack
        gap="$3"
        paddingBottom={index > 0 ? '$3' : 0}
        paddingTop={index > 0 ? '$3' : 0}
        borderTopWidth={index > 0 ? 1 : 0}
        borderTopColor={ui.borderSubtle}
      >
        {body}
      </YStack>
    )
  }

  return (
    <CommercePanel padding="$4" gap="$3">
      {body}
    </CommercePanel>
  )
}
