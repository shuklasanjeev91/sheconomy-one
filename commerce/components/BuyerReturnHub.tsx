import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components/CommercePanel'
import { OrderIssueCommentsThread } from '~/commerce/components/OrderIssueCommentsThread'
import {
  canCancelReturnOrExchange,
  type BuyerReturnHubEntry,
} from '~/commerce/lib/customer-order-lifecycle'
import type { CustomerOrderItem } from '~/commerce/lib/customer-orders'
import { commerceRoutes } from '~/lib/routes'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { useAppUi } from '~/lib/theme/useAppUi'

type BuyerReturnHubProps = {
  entries: BuyerReturnHubEntry[]
  items: CustomerOrderItem[]
  issues: Array<{
    id: string
    order_item_id?: string | null
    resolution_note?: string | null
    resolution_action?: string | null
    issue_type?: string | null
    status?: string | null
    return_tracking_number?: string | null
  }>
  onCancelRequest?: (item: CustomerOrderItem) => void
  onOpenSupport?: () => void
}

function categoryLabel(category: BuyerReturnHubEntry['category']) {
  switch (category) {
    case 'needs_action':
      return 'Needs action'
    case 'in_progress':
      return 'In progress'
    case 'resolved':
      return 'Resolved'
    case 'declined':
      return 'Declined'
    default:
      return 'Update'
  }
}

export function BuyerReturnHub({
  entries,
  items,
  issues,
  onCancelRequest,
  onOpenSupport,
}: BuyerReturnHubProps) {
  const ui = useAppUi()
  const itemById = new Map(items.map((item) => [item.id, item]))

  if (!entries.length) return null

  return (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={14} fontWeight="800" color={ui.text}>
          Returns & exchanges
        </Text>
        <Text fontSize={12.5} color={ui.textSecondary}>
          Follow each request from approval to pickup, return delivery, refund, or replacement.
        </Text>
      </YStack>

      <YStack gap="$3">
        {entries.map((entry) => {
          const item = entry.orderItemId ? itemById.get(entry.orderItemId) ?? null : null
          const issue = issues.find((current) => current.id === entry.issueId) ?? null
          const canCancel = Boolean(item && issue && canCancelReturnOrExchange(issue))
          return (
            <YStack
              key={entry.issueId}
              gap="$3"
              padding="$3.5"
              borderRadius={14}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <XStack justifyContent="space-between" gap="$2" alignItems="flex-start" flexWrap="wrap">
                <YStack flex={1} minWidth={220} gap="$1.5">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <Text fontSize={13} fontWeight="800" color={ui.text}>
                      {entry.issueLabel}
                    </Text>
                    <Text
                      fontSize={11}
                      fontWeight="700"
                      color={entry.category === 'declined' ? ui.danger : ui.brand}
                    >
                      {categoryLabel(entry.category)}
                    </Text>
                  </XStack>
                  <Text fontSize={15} fontWeight="800" color={ui.text}>
                    {entry.actionLabel}
                  </Text>
                  {entry.actionDetail ? (
                    <Text fontSize={12.5} color={ui.textSecondary}>
                      {entry.actionDetail}
                    </Text>
                  ) : null}
                </YStack>
                <YStack
                  paddingHorizontal="$2.5"
                  paddingVertical="$1.5"
                  borderRadius={999}
                  backgroundColor={entry.category === 'needs_action' ? ui.roseTint : ui.surfaceMuted}
                >
                  <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                    {entry.statusLabel}
                  </Text>
                </YStack>
              </XStack>

              {item ? (
                <XStack gap="$3" alignItems="center">
                  <YStack
                    width={52}
                    height={52}
                    borderRadius={10}
                    overflow="hidden"
                    backgroundColor={ui.imagePlaceholder}
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {item.image_url ? (
                      <Image src={item.image_url} width={52} height={52} objectFit="cover" />
                    ) : (
                      <Icons.Image size={18} color={ui.textMuted} />
                    )}
                  </YStack>
                  <YStack flex={1} minWidth={0} gap={2}>
                    <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
                      AFFECTED ITEM
                    </Text>
                    {item.listing_slug ? (
                      <AppLink href={commerceRoutes.listing(item.listing_slug)} asChild>
                        <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={2}>
                          {item.product_title}
                        </Text>
                      </AppLink>
                    ) : (
                      <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={2}>
                        {item.product_title}
                      </Text>
                    )}
                  </YStack>
                </XStack>
              ) : null}

              <YStack gap="$1.5" paddingLeft="$1">
                {entry.timeline.map((step) => (
                  <XStack key={step.id} gap="$2" alignItems="flex-start">
                    <YStack
                      width={8}
                      height={8}
                      borderRadius={999}
                      marginTop={5}
                      backgroundColor={step.done ? ui.brand : step.active ? ui.roseTint : ui.borderSubtle}
                    />
                    <YStack flex={1} minWidth={0} gap={1}>
                      <Text
                        fontSize={12}
                        fontWeight={step.active || step.done ? '700' : '500'}
                        color={step.done || step.active ? ui.text : ui.textMuted}
                      >
                        {step.label}
                      </Text>
                      {step.detail ? (
                        <Text fontSize={11} color={ui.textMuted}>
                          {step.detail}
                        </Text>
                      ) : null}
                    </YStack>
                  </XStack>
                ))}
              </YStack>

              {entry.returnTrackingNumber ? (
                <YStack
                  gap="$1.5"
                  padding="$3"
                  borderRadius={12}
                  backgroundColor={ui.surfaceMuted}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                >
                  <Text fontSize={12} fontWeight="700" color={ui.text}>
                    {entry.returnShippingMode === 'auto' || entry.returnShippingMode === 'vendor_arranged'
                      ? 'Pickup arranged by the shop'
                      : 'Return tracking'}
                  </Text>
                  {entry.returnCourierSlug ? (
                    <Text fontSize={12} color={ui.textSecondary}>
                      Courier: {entry.returnCourierSlug.replace(/_/g, ' ')}
                    </Text>
                  ) : null}
                  <Text fontSize={12} color={ui.textSecondary}>
                    AWB {entry.returnTrackingNumber}
                  </Text>
                  {entry.returnTrackingUrl ? (
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={999}
                      alignSelf="flex-start"
                      icon={<Icons.ExternalLink size={14} />}
                      onPress={() => void openExternalUrl(entry.returnTrackingUrl)}
                    >
                      Track return
                    </Button>
                  ) : null}
                </YStack>
              ) : null}

              {entry.evidenceLabel || entry.evidenceUrls.length > 0 ? (
                <YStack gap="$2">
                  <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
                    EVIDENCE
                  </Text>
                  {entry.evidenceLabel ? (
                    <Text fontSize={12} color={ui.textSecondary}>
                      {entry.evidenceLabel}
                    </Text>
                  ) : null}
                  {entry.evidenceUrls.length > 0 ? (
                    <XStack gap="$2" flexWrap="wrap">
                      {entry.evidenceUrls.slice(0, 4).map((url, index) => (
                        <YStack
                          key={`${entry.issueId}-${index}`}
                          width={56}
                          height={56}
                          borderRadius={10}
                          overflow="hidden"
                          backgroundColor={ui.imagePlaceholder}
                        >
                          <Image src={url} width={56} height={56} objectFit="cover" />
                        </YStack>
                      ))}
                    </XStack>
                  ) : null}
                </YStack>
              ) : null}

              {entry.refundLabel || entry.rejectReason ? (
                <YStack gap="$1">
                  {entry.refundLabel ? (
                    <Text fontSize={12} color={ui.textSecondary}>
                      {entry.refundLabel}
                    </Text>
                  ) : null}
                  {entry.rejectReason ? (
                    <Text fontSize={12} color={ui.danger}>
                      {entry.rejectReason}
                    </Text>
                  ) : null}
                </YStack>
              ) : null}

              <XStack gap="$2" flexWrap="wrap">
                {entry.returnTrackingUrl ? (
                  <Button
                    tone="primary"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.ExternalLink size={14} />}
                    onPress={() => void openExternalUrl(entry.returnTrackingUrl!)}
                  >
                    Track return
                  </Button>
                ) : null}
                {canCancel && item ? (
                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.X size={14} />}
                    onPress={() => onCancelRequest?.(item)}
                  >
                    Cancel request
                  </Button>
                ) : null}
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  icon={<Icons.MessageCircle size={14} />}
                  onPress={() => onOpenSupport?.()}
                >
                  Get help
                </Button>
              </XStack>

              <OrderIssueCommentsThread
                ui={ui}
                issueId={entry.issueId}
                resolutionNote={entry.resolutionNote}
                compact
              />
            </YStack>
          )
        })}
      </YStack>
    </CommercePanel>
  )
}
