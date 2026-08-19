import { AppLink } from '~/components/navigation/AppLink'

import { usePostPurchaseHomeNudges } from '~/commerce/hooks/usePostPurchaseHomeNudges'
import { CommercePanel } from '~/commerce/components'
import type { PostPurchaseNudgeItem } from '~/commerce/lib/post-purchase-nudges'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PostPurchaseHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { items, hasItems } = usePostPurchaseHomeNudges()

  if (!hasItems) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Buy again
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Reorder delivered favorites or leave a review to help others shop with confidence.
        </Text>
      </YStack>

      <YStack gap="$3">
        {items.map((item) => (
          <PostPurchaseHomeRow key={`${item.itemId}-${item.listingId}`} item={item} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.orders} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          View orders
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function PostPurchaseHomeRow({ item }: { item: PostPurchaseNudgeItem }) {
  const ui = useAppUi()
  const href = commerceRoutes.listing(item.listingSlug ?? item.listingId)

  return (
    <AppLink href={href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={72}
          height={72}
          borderRadius={12}
          overflow="hidden"
          backgroundColor={ui.imagePlaceholder}
          alignItems="center"
          justifyContent="center"
        >
          {item.imageUrl ? (
            <Image src={item.imageUrl} width={72} height={72} objectFit="cover" />
          ) : (
            <Icons.Package size={22} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {item.label}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {item.title}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
            {item.detail}
          </Text>
        </YStack>
      </XStack>
    </AppLink>
  )
}
