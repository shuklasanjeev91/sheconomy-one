import { AppLink } from '~/components/navigation/AppLink'
import { Image, Text, XStack, YStack } from '~/components/ui'
import { formatMoneyLabel } from '~/lib/format'
import type { SheaiRecommendItem } from '~/lib/search/sheai'
import { useAppUi } from '~/lib/theme/useAppUi'

type SheaiHitRowProps = {
  item: SheaiRecommendItem
  onPress?: () => void
}

export function SheaiHitRow({ item, onPress }: SheaiHitRowProps) {
  const ui = useAppUi()
  const price = item.price != null ? formatMoneyLabel(item.price, 'INR') : null

  return (
    <AppLink href={item.href as import('one').Href} asChild>
      <XStack
        gap="$3"
        alignItems="center"
        paddingVertical="$2.5"
        paddingHorizontal="$3"
        borderRadius={12}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
        width="100%"
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            width={44}
            height={44}
            borderRadius={10}
            objectFit="cover"
            alt=""
            backgroundColor={ui.surfaceMuted}
          />
        ) : (
          <YStack
            width={44}
            height={44}
            borderRadius={10}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={14} color={ui.brand}>
              ✦
            </Text>
          </YStack>
        )}

        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={14} fontWeight="600" color={ui.text} numberOfLines={1}>
            {item.title}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
            {item.shopName || item.category || 'Suggested by SHEai'}
          </Text>
        </YStack>

        <YStack alignItems="flex-end" gap={2} flexShrink={0}>
          {price ? (
            <Text fontSize={12} fontWeight="700" color={ui.text}>
              {price}
            </Text>
          ) : null}
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            SHEai
          </Text>
        </YStack>
      </XStack>
    </AppLink>
  )
}
