import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { PostProductStack } from '~/community/components/PostProductStack'
import type { PostProduct } from '~/community/lib/community'
import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { communityRoutes } from '~/lib/routes'
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

  return (
    <SectionShell>
      <XStack alignItems="center" justifyContent="space-between" gap={12}>
        <XStack alignItems="center" gap={8} flex={1} minWidth={0}>
          <Icons.ShoppingBag size={18} color={ui.brand} />
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Shop from posts
          </Text>
        </XStack>
        {shopHref && products.length > 3 ? (
          <AppLink href={shopHref}>
            <Button tone="ghost" size="$2">
              View all
            </Button>
          </AppLink>
        ) : null}
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
