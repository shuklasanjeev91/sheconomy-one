import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { Text, YStack } from '~/components/ui'
import { useShop } from '~/commerce/hooks/useShop'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

/** Public shop shipping policy overview. */
export default function ShopShippingRoute() {
  const ui = useAppUi()
  const { slug } = useParams<{ slug?: string }>()
  const shopSlug = slug?.trim() ?? ''
  const { shop } = useShop(shopSlug)

  usePageSeo({
    title: shop ? `Shipping · ${shop.shop_name}` : 'Shipping',
    description: shop
      ? `Shipping policy for ${shop.shop_name} on SHEconomy.`
      : 'Shop shipping policy on SHEconomy.',
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
          Shipping
        </Text>
        <YStack gap="$2">
          <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
            Delivery estimates and shipping rates are calculated at checkout from this shop’s
            shipping profiles. The seller books their own courier and dispatches orders — then
            shares tracking so you can follow the package.
          </Text>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
