import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorDraftsHome } from '~/commerce/hooks/useVendorDraftsHome'
import type { VendorDraftHomeCard } from '~/commerce/lib/vendor-drafts-home'
import { Button, Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorDraftListingsHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorDraftsHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Draft listings to publish
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Unfinished listings waiting for photos, pricing, or a final review.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorDraftHomeRow key={card.listingId} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorRoutes.products} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open products
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorDraftHomeRow({ card }: { card: VendorDraftHomeCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
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
          {card.imageUrl ? (
            <Image src={card.imageUrl} width={72} height={72} objectFit="cover" />
          ) : (
            <Icons.FileText size={22} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            Draft
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
