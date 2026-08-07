import { useEffect, useState } from 'react'
import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { HtmlContent } from '~/commerce/components'
import { Spinner, Text, YStack } from '~/components/ui'
import { useShop } from '~/commerce/hooks/useShop'
import { commerceRoutes } from '~/lib/routes'
import {
  defaultShopLegalTitle,
  fetchShopLegalDocument,
  type ShopLegalDocType,
} from '~/lib/shop/shop-legal.service'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

type ShopLegalScreenProps = {
  docType: ShopLegalDocType
}

/** Public shop mini-app legal page (privacy / terms / refunds). */
export function ShopLegalScreen({ docType }: ShopLegalScreenProps) {
  const ui = useAppUi()
  const { slug } = useParams<{ slug?: string }>()
  const shopSlug = slug?.trim() ?? ''
  const { shop, isLoading: shopLoading } = useShop(shopSlug)
  const [body, setBody] = useState<string | null>(null)
  const [title, setTitle] = useState(defaultShopLegalTitle(docType))
  const [loading, setLoading] = useState(true)

  usePageSeo({
    title: shop ? `${title} · ${shop.shop_name}` : title,
    description: shop
      ? `${title} for ${shop.shop_name} on SHEconomy.`
      : `${title} for this shop on SHEconomy.`,
  })

  useEffect(() => {
    if (!shop?.id) {
      setLoading(shopLoading)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchShopLegalDocument(shop.id, docType).then((result) => {
      if (cancelled) return
      if (result.data) {
        setTitle(result.data.title || defaultShopLegalTitle(docType))
        setBody(result.data.body_markdown)
      } else {
        setTitle(defaultShopLegalTitle(docType))
        setBody(null)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [shop?.id, docType, shopLoading])

  if (shopLoading || loading) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (!shop) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$8" gap="$3">
          <Text fontSize={20} fontWeight="800" color={ui.text}>
            Shop not found
          </Text>
          <AppLink href={commerceRoutes.shops}>
            <Text color={ui.brand}>Browse shops</Text>
          </AppLink>
        </PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" gap="$4" maxWidth={720}>
        <AppLink href={commerceRoutes.shop(shop.slug || shopSlug)}>
          <Text fontSize={13} fontWeight="600" color={ui.brand}>
            ← {shop.shop_name}
          </Text>
        </AppLink>
        <Text fontSize={28} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
          {title}
        </Text>
        {body?.trim() ? (
          <HtmlContent html={body.includes('<') ? body : body.replace(/\n/g, '<br/>')} />
        ) : (
          <YStack gap="$2">
            <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
              {shop.shop_name} has not published a {defaultShopLegalTitle(docType).toLowerCase()}{' '}
              yet. Contact the seller for details, or review SHEconomy platform policies.
            </Text>
            <AppLink href="/legal/privacy">
              <Text color={ui.brand}>Platform privacy</Text>
            </AppLink>
          </YStack>
        )}
      </PageSection>
    </FullWidthLayout>
  )
}
