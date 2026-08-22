import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { PostProductStack } from '~/community/components/PostProductStack'
import { CommunityShell } from '~/community/components/CommunityShell'
import { fetchPublicProfile } from '~/community/lib/network'
import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import type { PostProduct } from '~/community/lib/community'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { communityRoutes, commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

export function ProfileShopScreen() {
  const ui = useAppUi()
  const { username: handle } = useParams<{ username: string }>()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  usePageSeo(
    useMemo(() => {
      if (!displayName) return null
      return {
        title: `Shop from ${displayName}'s posts`,
        description: `Products ${displayName} has shared in community posts on SHEconomy.`,
      }
    }, [displayName]),
  )

  useEffect(() => {
    if (!handle) return
    let cancelled = false
    setLoading(true)
    void fetchPublicProfile(handle).then(async ({ data, error: profileError }) => {
      if (cancelled) return
      if (!data || profileError) {
        setError(profileError ?? 'Profile not found')
        setLoading(false)
        return
      }
      setDisplayName(data.full_name || data.username || handle)
      setProfileUserId(data.id)
      const rows = await fetchProfileShoppableProducts(data.id, 24)
      if (cancelled) return
      setProducts(rows)
      setError(null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [handle])

  if (loading) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={ui.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (error || !profileUserId) {
    return (
      <CommunityShell wide>
        <YStack gap={12} paddingVertical="$8" alignItems="center">
          <Text color={ui.textSecondary}>{error ?? 'Profile not found'}</Text>
          {handle ? (
            <AppLink href={communityRoutes.userProfile(handle)}>
              <Button tone="outline">Back to profile</Button>
            </AppLink>
          ) : null}
        </YStack>
      </CommunityShell>
    )
  }

  return (
    <CommunityShell wide>
      <FullWidthLayout>
        <PageSection>
          <YStack gap={16}>
            <XStack alignItems="center" justifyContent="space-between" gap={12} flexWrap="wrap">
              <YStack gap={4} flex={1} minWidth={0}>
                <XStack alignItems="center" gap={8}>
                  <Icons.ShoppingBag size={22} color={ui.brand} />
                  <Text fontSize={22} fontWeight="800" color={ui.text}>
                    Shop from posts
                  </Text>
                </XStack>
                <Text fontSize={14} color={ui.textSecondary}>
                  Products {displayName} has shared in community posts.
                </Text>
              </YStack>
              {handle ? (
                <XStack gap={8} flexWrap="wrap">
                  {products.find((product) => product.shopSlug)?.shopSlug ? (
                    <AppLink
                      href={commerceRoutes.shop(
                        products.find((product) => product.shopSlug)!.shopSlug!,
                      )}
                    >
                      <Button tone="outline" size="$3" icon={<Icons.Store size={16} />}>
                        Visit shop
                      </Button>
                    </AppLink>
                  ) : null}
                  <AppLink href={communityRoutes.userProfile(handle)}>
                    <Button tone="ghost" size="$3" icon={<Icons.ArrowLeft size={16} />}>
                      Profile
                    </Button>
                  </AppLink>
                </XStack>
              ) : null}
            </XStack>

            {products.length ? (
              <PostProductStack
                products={products}
                postId={`profile-shop-${profileUserId}`}
                source="profile_shop"
                layout="stack"
              />
            ) : (
              <YStack
                padding={24}
                borderRadius={12}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
                alignItems="center"
                gap={8}
              >
                <Icons.Package size={28} color={ui.textMuted} />
                <Text fontSize={15} fontWeight="600" color={ui.text}>
                  No shoppable posts yet
                </Text>
                <Text fontSize={13} color={ui.textSecondary} textAlign="center">
                  When this member attaches products to posts, they will appear here.
                </Text>
              </YStack>
            )}
          </YStack>
        </PageSection>
      </FullWidthLayout>
    </CommunityShell>
  )
}
