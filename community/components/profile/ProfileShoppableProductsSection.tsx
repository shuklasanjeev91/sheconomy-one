import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { PostProductStack } from '~/community/components/PostProductStack'
import type { PostProduct } from '~/community/lib/community'
import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { ShareButton } from '~/components/share/ShareButton'
import { BRAND_NAME } from '~/config/brand'
import { trackCommunityCommerceShare } from '~/community/lib/community-commerce-analytics'
import { getProfileShopShareUrl } from '~/lib/share/urls'
import { commerceRoutes, communityRoutes } from '~/lib/routes'
import { radius } from '~/config/tokens'

export function ProfileShoppableProductsSection({
  profileUserId,
  profileHandle,
}: {
  profileUserId: string
  profileHandle?: string | null
}) {
  const ui = useAppUi()
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchProfileShoppableProducts(profileUserId, 12).then((rows) => {
      if (cancelled) return
      setProducts(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [profileUserId])

  if (loading) {
    return (
      <SectionShell>
        <XStack paddingVertical={24} justifyContent="center">
          <Spinner size="small" color={ui.brand} />
        </XStack>
      </SectionShell>
    )
  }

  if (!products.length) return null

  const preview = products.slice(0, 6)
  const shopHref =
    profileHandle && profileHandle.trim().length > 0
      ? communityRoutes.profileShop(profileHandle)
      : null
  const storefrontSlug = products.find((product) => product.shopSlug)?.shopSlug ?? null

  return (
    <SectionShell>
      <XStack alignItems="center" justifyContent="space-between" gap={12} flexWrap="wrap">
        <XStack alignItems="center" gap={8} flex={1} minWidth={0}>
          <Icons.ShoppingBag size={18} color={ui.brand} />
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Shop from posts
          </Text>
        </XStack>
        <XStack gap={8} flexWrap="wrap">
          {profileHandle ? (
            <ShareButton
              variant="ghost"
              size="$2"
              label="Share shop"
              sheetTitle="Share shop from posts"
              copyLabel="Copy shop link"
              copyToastMessage="Shop link copied."
              onOpen={() =>
                trackCommunityCommerceShare({ surface: 'profile_shop', postId: profileUserId })
              }
              payload={{
                url: getProfileShopShareUrl(profileHandle),
                title: `Shop from posts on ${BRAND_NAME}`,
                text: 'Products shared in community posts.',
              }}
            />
          ) : null}
          {storefrontSlug ? (
            <AppLink href={commerceRoutes.shop(storefrontSlug)}>
              <Button tone="outline" size="$2" icon={<Icons.Store size={14} />}>
                Visit storefront
              </Button>
            </AppLink>
          ) : null}
          {shopHref && products.length > 3 ? (
            <AppLink href={shopHref}>
              <Button tone="ghost" size="$2">
                View all
              </Button>
            </AppLink>
          ) : null}
        </XStack>
      </XStack>
      <Text fontSize={13} color={ui.textSecondary}>
        Products this member has shared in their community posts.
      </Text>
      <PostProductStack
        products={preview}
        postId={`profile-${profileUserId}`}
        source="profile"
        layout={preview.length > 1 ? 'carousel' : 'stack'}
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
