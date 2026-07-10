import { Link, useLocalSearchParams, useRouter } from 'one'
import { useEffect } from 'react'

import { CreateShopForm } from '~/commerce/components/CreateShopForm'
import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { Button, Icons, Paragraph, Spinner, Text, XStack, YStack } from '~/components/ui'
import { PageContent, PageCenter } from '~/components/layout'
import { commerceRoutes } from '~/lib/routes'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function MyShopsScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ create?: string }>()
  const { shops, isLoading, error, refresh } = useVendorShops()
  const forceCreate = params.create === '1' || params.create === 'true'
  const hasShops = shops.length > 0
  const primaryShop = shops[0] ?? null

  useEffect(() => {
    if (!isLoading && hasShops && primaryShop && !forceCreate) {
      router.replace(commerceRoutes.manageShop(primaryShop.id))
    }
  }, [forceCreate, hasShops, isLoading, primaryShop, router])

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (hasShops && !forceCreate) {
    return (
      <PageCenter>
        <Spinner size="large" />
        <Text color={ui.textMuted} marginTop="$3">
          Opening seller hub…
        </Text>
      </PageCenter>
    )
  }

  return (
    <PageContent scroll paddingVertical="$4" paddingBottom="$10">
      <YStack gap="$6" width="100%" maxWidth={720} alignSelf="center">
        <CommercePageHeader
          title="Open your shop"
          subtitle={`Start selling on ${BRAND_NAME}. Create your storefront, add listings, and manage orders from one seller hub.`}
        />

        {error ? (
          <CommercePanel>
            <Paragraph color="$red10">{error}</Paragraph>
          </CommercePanel>
        ) : null}

        <CommercePanel gap="$4">
          <XStack gap="$3" alignItems="flex-start">
            <YStack
              width={52}
              height={52}
              borderRadius={16}
              alignItems="center"
              justifyContent="center"
              backgroundColor={ui.roseSurface}
            >
              <Icons.Store size={24} color={ui.brand} />
            </YStack>
            <YStack flex={1} gap="$1">
              <Text fontSize={16} fontWeight="700" color={ui.text}>
                Become a seller
              </Text>
              <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                Guests sign in first. Once you have an account, you can create one shop and manage
                listings like Etsy or Amazon seller central.
              </Text>
            </YStack>
          </XStack>

          <CreateShopForm
            onCreated={() => {
              void refresh()
            }}
          />
        </CommercePanel>

        <Link href={commerceRoutes.home} asChild>
          <Button tone="outline" size="$4" borderRadius={999}>
            Browse marketplace
          </Button>
        </Link>
      </YStack>
    </PageContent>
  )
}
