import { Link, Redirect, useLocalSearchParams } from 'one'
import { useState } from 'react'

import { CreateShopForm } from '~/commerce/components/CreateShopForm'
import {
  Avatar,
  Badge,
  Button,
  Card,
  H2,
  Icons,
  ListItem,
  Paragraph,
  Separator,
  Spinner,
  XStack,
  YStack,
} from '~/components/ui'
import { PageContent, PageCenter } from '~/components/layout'
import { formatRating } from '~/lib/format'
import { routes } from '~/lib/routes'
import { useVendorShops } from '~/hooks/useVendorShops'

import { BRAND_NAME } from '~/config/brand'

export function MyShopsScreen() {
  const params = useLocalSearchParams<{ create?: string }>()
  const { shops, isLoading, error, isAuthenticated, refresh } = useVendorShops()
  const [showCreate, setShowCreate] = useState(params.create === '1' || params.create === 'true')

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href={routes.signIn} />
  }

  const hasShops = shops.length > 0
  const openCreate = showCreate || !hasShops

  return (
    <PageContent scroll paddingVertical="$4" paddingBottom="$10">
      <YStack gap="$5" width="100%">
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1}>
            <H2 letterSpacing={-0.3}>My shops</H2>
            <Paragraph color="$color10">
              {hasShops
                ? `Manage your storefronts on ${BRAND_NAME}.`
                : 'Open your first shop and start selling to the community.'}
            </Paragraph>
          </YStack>
          {hasShops && !showCreate ? (
            <Button tone="primary" size="$3" borderRadius={999} onPress={() => setShowCreate(true)}>
              Add shop
            </Button>
          ) : null}
        </XStack>

        {error ? (
          <Card>
            <Paragraph color="$red10">{error}</Paragraph>
          </Card>
        ) : null}

        {openCreate ? (
          <Card elevated gap="$3">
            <CreateShopForm
              onCreated={() => {
                setShowCreate(false)
                void refresh()
              }}
              onCancel={hasShops ? () => setShowCreate(false) : undefined}
            />
          </Card>
        ) : null}

        {hasShops ? (
          <Card padding="$0" overflow="hidden">
            {shops.map((shop, index) => (
              <YStack key={shop.id}>
                <Link href={routes.shop(shop.id)} asChild>
                  <ListItem
                    icon={
                      <Avatar
                        name={shop.shop_name}
                        src={shop.logo_url ?? undefined}
                        size="$4"
                      />
                    }
                    title={shop.shop_name}
                    subTitle={`${formatRating(shop.average_rating)} · ${shop.total_reviews ?? 0} reviews`}
                    iconAfter={
                      <XStack gap="$2" alignItems="center">
                        <Badge tone={shop.is_active ? 'success' : 'warning'} size="sm">
                          {shop.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Icons.ChevronRight size={16} color="$color9" />
                      </XStack>
                    }
                  />
                </Link>
                {index < shops.length - 1 ? <Separator /> : null}
              </YStack>
            ))}
          </Card>
        ) : null}

        <Link href={routes.home} asChild>
          <Button tone="outline" size="$4">
            Browse shops
          </Button>
        </Link>
      </YStack>
    </PageContent>
  )
}