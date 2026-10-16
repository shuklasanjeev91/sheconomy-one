import { useState } from 'react'

import {
  priceWatchFor,
  removePriceWatch,
  savePriceWatch,
  usePriceWatches,
} from '~/commerce/lib/price-watches'
import { Button, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { useAppUi } from '~/lib/theme/useAppUi'

type PriceWatchCardProps = {
  listingId: string
  title: string
  price: number | null | undefined
  currency: string
}

/** Ask Home to flag this listing when its price is at or under a target. */
export function PriceWatchCard({ listingId, title, price, currency }: PriceWatchCardProps) {
  const ui = useAppUi()
  const watches = usePriceWatches()
  const current = priceWatchFor(listingId, watches)
  const [draft, setDraft] = useState(price && price > 0 ? String(price) : '')

  if (price == null || !Number.isFinite(price) || price <= 0) return null

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.Bell size={16} color={ui.brand} />
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          Price watch
        </Text>
      </XStack>
      {current ? (
        <YStack gap="$2">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            Home will highlight this when it is {formatCurrency(current.targetPrice, current.currency)} or less.
          </Text>
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            alignSelf="flex-start"
            onPress={() => removePriceWatch(listingId)}
          >
            Stop watching
          </Button>
        </YStack>
      ) : (
        <YStack gap="$2">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            Set the most you want to pay. This stays on this device.
          </Text>
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={String(price)}
              accessibilityLabel="Target price"
            />
            <Button
              tone="primary"
              size="$3"
              borderRadius={999}
              onPress={() => {
                const target = Number(draft.replace(/,/g, ''))
                savePriceWatch({
                  listingId,
                  targetPrice: Number.isFinite(target) && target > 0 ? target : price,
                  currency,
                  title,
                })
              }}
            >
              Watch
            </Button>
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}
