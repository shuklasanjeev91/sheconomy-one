import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useBuyerListingInquiriesHome } from '~/commerce/hooks/useBuyerListingInquiriesHome'
import type { BuyerListingInquiryCard } from '~/commerce/lib/buyer-listing-inquiries-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BuyerListingInquiryHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useBuyerListingInquiriesHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Your listing questions
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Open inquiries and seller replies on items you asked about.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <BuyerListingInquiryRow key={card.inquiryId} card={card} />
        ))}
      </YStack>

      <AppLink href={commerceRoutes.home} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Browse marketplace
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function BuyerListingInquiryRow({ card }: { card: BuyerListingInquiryCard }) {
  const ui = useAppUi()

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.MessageCircle size={18} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {card.badge}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.preview}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
