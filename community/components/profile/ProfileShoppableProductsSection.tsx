import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import { PostProductStack } from '~/community/components/PostProductStack'
import type { PostProduct } from '~/community/lib/community'
import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { radius } from '~/config/tokens'

export function ProfileShoppableProductsSection({
  profileUserId,
}: {
  profileUserId: string
}) {
  const ui = useAppUi()
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchProfileShoppableProducts(profileUserId).then((rows) => {
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

  return (
    <SectionShell>
      <XStack alignItems="center" gap={8}>
        <Icons.ShoppingBag size={18} color={ui.brand} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          Shop from posts
        </Text>
      </XStack>
      <Text fontSize={13} color={ui.textSecondary}>
        Products this member has shared in their community posts.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap={12} paddingVertical={4} minWidth="100%">
          <YStack width={320} maxWidth="100%">
            <PostProductStack products={products.slice(0, 3)} postId={`profile-${profileUserId}`} />
          </YStack>
        </XStack>
      </ScrollView>
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
