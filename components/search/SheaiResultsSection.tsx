import { AppLink } from '~/components/navigation/AppLink'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { formatMoneyLabel } from '~/lib/format'
import type { SheaiRecommendItem } from '~/lib/search/sheai'
import { useAppUi } from '~/lib/theme/useAppUi'

type SheaiResultsSectionProps = {
  query: string
  items: SheaiRecommendItem[]
  loading?: boolean
  error?: string | null
  compact?: boolean
  onItemPress?: (item: SheaiRecommendItem) => void
}

export function SheaiResultsSection({
  query,
  items,
  loading = false,
  error = null,
  compact,
  onItemPress,
}: SheaiResultsSectionProps) {
  const ui = useAppUi()

  if (!loading && !error && items.length === 0) return null

  return (
    <YStack
      gap={compact ? '$2' : '$3'}
      width="100%"
      padding={compact ? '$2.5' : '$3.5'}
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.roseSurface}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Icons.Sparkles size={16} color={ui.brand} />
          <YStack flex={1} minWidth={0}>
            <Text fontSize={compact ? 14 : 16} fontWeight="800" color={ui.text}>
              SHEai picked these for you
            </Text>
            {query ? (
              <Text fontSize={12} color={ui.textMuted} numberOfLines={1} fontStyle="italic">
                “{query}”
              </Text>
            ) : null}
          </YStack>
        </XStack>
        <XStack
          paddingHorizontal="$2.5"
          paddingVertical="$1"
          borderRadius={999}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            {loading ? '…' : `${items.length} match${items.length === 1 ? '' : 'es'}`}
          </Text>
        </XStack>
      </XStack>

      {loading ? (
        <XStack alignItems="center" gap="$2" paddingVertical="$3">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textSecondary}>
            SHEai is understanding you…
          </Text>
        </XStack>
      ) : null}

      {error && !loading ? (
        <Text fontSize={13} color={ui.danger}>
          {error}
        </Text>
      ) : null}

      {!loading && items.length > 0 ? (
        <HorizontalScrollRow gap="$3">
          {items.map((item) => (
            <SheaiResultCard
              key={`${item.slug ?? item.href}-${item.title}`}
              item={item}
              onPress={onItemPress ? () => onItemPress(item) : undefined}
            />
          ))}
        </HorizontalScrollRow>
      ) : null}
    </YStack>
  )
}

export function SheaiResultCard({
  item,
  onPress,
}: {
  item: SheaiRecommendItem
  onPress?: () => void
}) {
  const ui = useAppUi()
  const price = item.price != null ? formatMoneyLabel(item.price, 'INR') : null

  return (
    <AppLink href={item.href as import('one').Href} asChild>
      <YStack
        width={180}
        flexShrink={0}
        gap="$2"
        padding="$2"
        borderRadius={14}
        backgroundColor={ui.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        cursor="pointer"
        hoverStyle={{ borderColor: ui.brand }}
        pressStyle={{ opacity: 0.92 }}
        onPress={onPress}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            width={164}
            height={164}
            borderRadius={12}
            objectFit="cover"
            alt={item.title}
            backgroundColor={ui.surfaceMuted}
          />
        ) : (
          <YStack
            width={164}
            height={164}
            borderRadius={12}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={22} color={ui.brand}>
              ✦
            </Text>
          </YStack>
        )}
        {item.category ? (
          <Text fontSize={10} fontWeight="700" color={ui.brand} numberOfLines={1} textTransform="uppercase">
            {item.category}
          </Text>
        ) : null}
        <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={2} minHeight={36}>
          {item.title}
        </Text>
        {item.shopName ? (
          <XStack alignItems="center" gap="$1.5" minWidth={0}>
            {item.logoUrl ? (
              <Image
                src={item.logoUrl}
                width={16}
                height={16}
                borderRadius={999}
                objectFit="cover"
                alt=""
                backgroundColor={ui.surfaceMuted}
              />
            ) : null}
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1} flex={1}>
              {item.shopName}
            </Text>
          </XStack>
        ) : null}
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            {price ?? ' '}
          </Text>
          <XStack alignItems="center" gap="$1.5">
            <YStack
              width={32}
              height={4}
              borderRadius={999}
              backgroundColor={ui.surfaceMuted}
              overflow="hidden"
            >
              <YStack
                height={4}
                width={`${item.score}%`}
                borderRadius={999}
                backgroundColor={ui.brand}
              />
            </YStack>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
              {item.score}%
            </Text>
          </XStack>
        </XStack>
      </YStack>
    </AppLink>
  )
}
