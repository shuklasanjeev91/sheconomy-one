import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { CommercePanel } from '~/commerce/components/CommercePanel'
import type {
  PostPurchaseNudgeItem,
  PostPurchaseNudgeSection,
} from '~/commerce/lib/post-purchase-nudges'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type PostPurchaseNudgesSectionProps = {
  section: PostPurchaseNudgeSection
  onReorder: (item: PostPurchaseNudgeItem) => void
  onWriteReview: (item: PostPurchaseNudgeItem) => void
  onGetHelp: (item: PostPurchaseNudgeItem) => void
  onBulkReorder?: (section: PostPurchaseNudgeSection) => void
}

export function PostPurchaseNudgesSection({
  section,
  onReorder,
  onWriteReview,
  onGetHelp,
  onBulkReorder,
}: PostPurchaseNudgesSectionProps) {
  const ui = useAppUi()

  return (
    <CommercePanel gap="$3">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={220}>
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {section.title}
          </Text>
          <Text fontSize={12.5} color={ui.textSecondary}>
            {section.subtitle}
          </Text>
        </YStack>
        {section.canBulkReorder ? (
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            icon={<Icons.ShoppingCart size={14} />}
            onPress={() => onBulkReorder?.(section)}
          >
            {section.actionLabel}
          </Button>
        ) : null}
      </XStack>

      <YStack gap="$3">
        {section.items.map((item) => (
          <NudgeRow
            key={`${section.key}-${item.itemId}`}
            item={item}
            onReorder={onReorder}
            onWriteReview={onWriteReview}
            onGetHelp={onGetHelp}
          />
        ))}
      </YStack>
    </CommercePanel>
  )
}

function NudgeRow({
  item,
  onReorder,
  onWriteReview,
  onGetHelp,
}: {
  item: PostPurchaseNudgeItem
  onReorder: (item: PostPurchaseNudgeItem) => void
  onWriteReview: (item: PostPurchaseNudgeItem) => void
  onGetHelp: (item: PostPurchaseNudgeItem) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2.5" padding="$3.5" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={56}
          height={56}
          borderRadius={10}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {item.imageUrl ? (
            <Image src={item.imageUrl} width={56} height={56} objectFit="cover" />
          ) : (
            <Icons.Image size={18} color={ui.textMuted} />
          )}
        </YStack>

        <YStack flex={1} minWidth={0} gap="$1.5">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontSize={11} fontWeight="800" color={ui.brand}>
              {item.label}
            </Text>
            <Text fontSize={11} color={ui.textMuted}>
              Qty {item.quantity}
            </Text>
          </XStack>
          {item.listingSlug ? (
            <AppLink href={commerceRoutes.listing(item.listingSlug)} asChild>
              <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
                {item.title}
              </Text>
            </AppLink>
          ) : (
            <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
              {item.title}
            </Text>
          )}
          <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
            {item.detail}
          </Text>
        </YStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {item.source === 'reorder' ? (
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            icon={<Icons.ShoppingCart size={14} />}
            onPress={() => onReorder(item)}
          >
            Reorder
          </Button>
        ) : item.source === 'review' ? (
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            icon={<Icons.Star size={14} />}
            onPress={() => onWriteReview(item)}
          >
            Write review
          </Button>
        ) : null}

        {item.listingSlug ? (
          <AppLink href={commerceRoutes.listing(item.listingSlug)} asChild>
            <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.ExternalLink size={14} />}>
              Open listing
            </Button>
          </AppLink>
        ) : null}

        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.MessageCircle size={14} />}
          onPress={() => onGetHelp(item)}
        >
          Get help
        </Button>
      </XStack>
    </YStack>
  )
}
