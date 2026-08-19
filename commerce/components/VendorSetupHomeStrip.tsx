import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorSetupHome } from '~/commerce/hooks/useVendorSetupHome'
import type { VendorSetupHomeCard } from '~/commerce/lib/vendor-setup-home'
import { vendorSetupHomeHref } from '~/commerce/lib/vendor-setup-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorSetupHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorSetupHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Finish shop setup
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Connect payments and shipping so buyers can checkout smoothly.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorSetupHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorSetupHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open shop settings
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorSetupHomeRow({ card }: { card: VendorSetupHomeCard }) {
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
          <Icons.Settings size={18} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {card.badge}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.detail}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
