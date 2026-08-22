import { useEffect, useState } from 'react'

import { PostProductStack } from '~/community/components/PostProductStack'
import type { PostProduct } from '~/community/lib/community'
import { fetchShopShoppableProducts } from '~/community/lib/shop-shoppable-products'
import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ShareButton } from '~/components/share/ShareButton'
import { BRAND_NAME } from '~/config/brand'
import { trackCommunityCommerceShare } from '~/community/lib/community-commerce-analytics'
import { getProfileShopShareUrl } from '~/lib/share/urls'
import { useAppUi } from '~/lib/theme/useAppUi'
import { radius } from '~/config/tokens'

export function ShopCommunityProductsSection({
  shopId,
  ownerUserId,
  ownerHandle,
  shopName,
}: {
  shopId: string
  ownerUserId: string
  ownerHandle?: string | null
  shopName?: string | null
}) {
  const ui = useAppUi()
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchShopShoppableProducts(shopId, ownerUserId, 12).then((rows) => {
      if (cancelled) return
      setProducts(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [shopId, ownerUserId])

  if (loading) {
    return (
      <SectionShell>
        <XStack paddingVertical={20} justifyContent="center">
          <Spinner size="small" color={ui.brand} />
        </XStack>
      </SectionShell>
    )
  }

  if (!products.length) return null

  const profileShopHref =
    ownerHandle && ownerHandle.trim().length > 0
      ? communityRoutes.profileShop(ownerHandle)
      : null

  return (
    <SectionShell>
      <XStack alignItems="center" justifyContent="space-between" gap={12}>
        <XStack alignItems="center" gap={8} flex={1} minWidth={0}>
          <Icons.Users size={18} color={ui.brand} />
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Featured in community
          </Text>
        </XStack>
        {profileShopHref ? (
          <XStack gap={6} alignItems="center">
            <ShareButton
              variant="icon"
              label="Share shop from posts"
              sheetTitle="Share shop from posts"
              copyLabel="Copy shop link"
              copyToastMessage="Shop link copied."
              onOpen={() =>
                trackCommunityCommerceShare({ surface: 'shop_community', postId: `shop-${shopId}` })
              }
              payload={{
                url: getProfileShopShareUrl(ownerHandle!),
                title: shopName ? `Shop ${shopName} on ${BRAND_NAME}` : `Shop on ${BRAND_NAME}`,
                text: 'Products featured in community posts.',
              }}
            />
            <AppLink href={profileShopHref}>
              <Button tone="ghost" size="$2">
                View all
              </Button>
            </AppLink>
          </XStack>
        ) : null}
      </XStack>
      <Text fontSize={13} color={ui.textSecondary}>
        {shopName
          ? `Products ${shopName} has shared in community posts.`
          : 'Products shared in community posts from this shop.'}
      </Text>
      <PostProductStack
        products={products.slice(0, 6)}
        postId={`shop-community-${shopId}`}
        source="profile_shop"
        layout={products.length > 1 ? 'carousel' : 'stack'}
      />
    </SectionShell>
  )
}

function SectionShell({ children }: { children: React.ReactNode }) {
  const ui = useAppUi()
  return (
    <YStack
      gap={12}
      padding={16}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      {children}
    </YStack>
  )
}
