import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { Text, YStack } from '~/components/ui'
import { useShop } from '~/commerce/hooks/useShop'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

/** Public shop returns policy — links into seller return-policy content when published. */
export default function ShopReturnsRoute() {
  const ui = useAppUi()
  const { slug } = useParams<{ slug?: string }>()
  const shopSlug = slug?.trim() ?? ''
  const { shop } = useShop(shopSlug)

  usePageSeo({
    title: shop ? `Returns · ${shop.shop_name}` : 'Returns',
    description: shop
      ? `Return policy for ${shop.shop_name} on SHEconomy.`
      : 'Shop return policy on SHEconomy.',
  })

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" gap="$4" maxWidth={720}>
        {shop ? (
          <AppLink href={commerceRoutes.shop(shop.slug || shopSlug)}>
            <Text fontSize={13} fontWeight="600" color={ui.brand}>
              ← {shop.shop_name}
            </Text>
          </AppLink>
        ) : null}
        <Text fontSize={28} fontWeight="800" color={ui.text}>
          Returns
        </Text>
        <YStack gap="$2">
          <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
            Return windows and eligibility are set by this shop’s return policies on each listing.
            Open a product page for the exact return terms, or contact the seller.
          </Text>
          {shop ? (
            <AppLink href={commerceRoutes.shopRefunds(shop.slug || shopSlug)}>
              <Text color={ui.brand}>View refund policy</Text>
            </AppLink>
          ) : null}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
