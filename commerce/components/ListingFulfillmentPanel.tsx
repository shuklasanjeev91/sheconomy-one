import { Icons, Text, XStack, YStack } from '~/components/ui'
import type { ListingFulfillmentInfo } from '~/commerce/lib/listing-fulfillment'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingFulfillmentPanelProps = {
  info: ListingFulfillmentInfo
  compact?: boolean
}

/** Etsy-style shipping / digital download details on the listing page. */
export function ListingFulfillmentPanel({ info, compact = false }: ListingFulfillmentPanelProps) {
  const ui = useAppUi()

  if (compact) {
    return <ListingFulfillmentCompact info={info} />
  }
  if (info.kind === 'digital') {
    return (
      <YStack
        gap="$3"
        padding="$4"
        borderRadius={8}
        borderWidth={1}
        borderColor={ui.panelBorder}
        backgroundColor={ui.panelBg}
        width="100%"
      >
        <XStack gap="$3" alignItems="flex-start">
          <YStack
            width={40}
            height={40}
            borderRadius={999}
            backgroundColor={ui.digitalBg}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.Download size={18} color={ui.digitalText} />
          </YStack>
          <YStack flex={1} gap="$2">
            <Text fontWeight="600" fontSize={15} color={ui.text}>
              {info.deliveryLabel}
            </Text>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
              Your files will be available to download after purchase. No shipping required.
            </Text>
            {info.fileTypeLabel ? (
              <FulfillmentRow icon={<Icons.FileText size={14} color={ui.textSecondary} />} label={info.fileTypeLabel} />
            ) : null}
            {info.fileSizeLabel ? (
              <FulfillmentRow icon={<Icons.HardDrive size={14} color={ui.textSecondary} />} label={info.fileSizeLabel} />
            ) : null}
            {info.downloadLimitLabel ? (
              <FulfillmentRow icon={<Icons.RefreshCw size={14} color={ui.textSecondary} />} label={info.downloadLimitLabel} />
            ) : null}
          </YStack>
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={8}
      borderWidth={1}
      borderColor={ui.panelBorder}
      backgroundColor={ui.panelBg}
      width="100%"
    >
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={40}
          height={40}
          borderRadius={999}
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Truck size={18} color={ui.text} />
        </YStack>
        <YStack flex={1} gap="$2">
          <Text fontWeight="600" fontSize={15} color={ui.text}>
            {info.estimatedDeliveryLabel}
          </Text>
          {info.providerLabel ? (
            <Text fontSize={13} color={ui.textSecondary}>
              Fulfilled via {info.providerLabel}
            </Text>
          ) : null}
          <FulfillmentRow icon={<Icons.Clock size={14} color={ui.textSecondary} />} label={info.processingLabel} />
          <FulfillmentRow icon={<Icons.Package size={14} color={ui.textSecondary} />} label={info.shippingCostLabel} />
          {info.shipsFromLabel ? (
            <FulfillmentRow icon={<Icons.MapPin size={14} color={ui.textSecondary} />} label={info.shipsFromLabel} />
          ) : null}
          {info.returnsLabel ? (
            <FulfillmentRow icon={<Icons.RotateCcw size={14} color={ui.textSecondary} />} label={info.returnsLabel} />
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  )
}

function FulfillmentRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  const ui = useAppUi()

  return (
    <XStack gap="$2" alignItems="center">
      {icon}
      <Text fontSize={13} color={ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}

function ListingFulfillmentCompact({ info }: { info: ListingFulfillmentInfo }) {
  const ui = useAppUi()

  if (info.kind === 'digital') {
    return (
      <YStack gap="$2" width="100%" paddingVertical="$1">
        <XStack gap="$2.5" alignItems="center">
          <Icons.Download size={16} color={ui.digitalText} />
          <Text fontWeight="600" fontSize={14} color={ui.text} flex={1}>
            {info.deliveryLabel}
          </Text>
        </XStack>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
          Download after purchase · No shipping
        </Text>
        {info.fileTypeLabel ? (
          <Text fontSize={13} color={ui.textSecondary}>
            {info.fileTypeLabel.replace('Digital file type: ', '')}
            {info.fileSizeLabel ? ` · ${info.fileSizeLabel.replace('File size: ', '')}` : ''}
          </Text>
        ) : null}
      </YStack>
    )
  }

  return (
    <YStack gap="$2" width="100%" paddingVertical="$1">
      <XStack gap="$2.5" alignItems="center">
        <Icons.Truck size={16} color={ui.text} />
        <Text fontWeight="600" fontSize={14} color={ui.text} flex={1}>
          {info.estimatedDeliveryLabel}
        </Text>
      </XStack>
      <Text fontSize={13} color={ui.textSecondary}>
        {info.processingLabel} · {info.shippingCostLabel}
      </Text>
    </YStack>
  )
}