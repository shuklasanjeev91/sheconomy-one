import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorInquiriesHome } from '~/commerce/hooks/useVendorInquiriesHome'
import type { VendorInquiriesHomeCard } from '~/commerce/lib/vendor-inquiries-home'
import { vendorInquiriesHomeHref } from '~/commerce/lib/vendor-inquiries-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorInquiriesHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorInquiriesHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Listing inquiries
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Buyer questions on your listings that still need a seller reply.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorInquiriesHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorInquiriesHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open inquiries
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorInquiriesHomeRow({ card }: { card: VendorInquiriesHomeCard }) {
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
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
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
