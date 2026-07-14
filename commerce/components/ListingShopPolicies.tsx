import { Icons, Text, XStack, YStack } from '~/components/ui'
import type { ListingShopPoliciesModel, ShopPolicySection } from '~/commerce/lib/shop-policies'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

import { SectionTitle } from './SectionTitle'

type ListingShopPoliciesProps = {
  policies: ListingShopPoliciesModel
}

/** Shop shipping / return / refund policies under listing product details. */
export function ListingShopPolicies({ policies }: ListingShopPoliciesProps) {
  const ui = useAppUi()
  const sections = [policies.shipping, policies.returns].filter(Boolean) as ShopPolicySection[]

  if (!sections.length) return null

  return (
    <YStack gap="$4" width="100%" paddingTop="$2">
      <SectionTitle
        title="Shipping & policies"
        subtitle="How this shop delivers, and what happens if you need a return or refund."
      />

      <YStack gap="$3" width="100%">
        {sections.map((section) => (
          <PolicyCard key={section.title} section={section} />
        ))}
      </YStack>

      <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
        Final shipping charges may vary by destination and are confirmed at checkout.
      </Text>
    </YStack>
  )
}

function PolicyCard({ section }: { section: ShopPolicySection }) {
  const ui = useAppUi()
  const isShipping =
    section.title.toLowerCase().includes('shipping') ||
    section.title.toLowerCase() === 'delivery'
  const Icon = isShipping ? Icons.Truck : Icons.RotateCcw

  return (
    <YStack
      gap="$2.5"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      width="100%"
    >
      <XStack alignItems="center" gap="$2">
        <Icon size={15} color={ui.brand} />
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          {section.title}
        </Text>
      </XStack>

      {section.points.map((point) => (
        <XStack key={point} gap="$2" alignItems="flex-start">
          <Icons.Check size={13} color={ui.success} style={{ marginTop: 2 }} />
          <Text fontSize={13} color={ui.textSecondary} flex={1} lineHeight={18}>
            {point}
          </Text>
        </XStack>
      ))}

      {section.details ? (
        <Text fontSize={12.5} color={ui.textMuted} lineHeight={18} paddingTop="$1">
          {section.details}
        </Text>
      ) : null}
    </YStack>
  )
}
