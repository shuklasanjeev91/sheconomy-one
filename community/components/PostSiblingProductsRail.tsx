import { useEffect, useMemo, useState } from 'react'

import { PostProductStack } from '~/community/components/PostProductStack'
import { fetchPostById } from '~/community/lib/community'
import type { PostProduct } from '~/community/lib/community'
import { trackCommunityPostSiblingImpression } from '~/community/lib/community-commerce-analytics'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, YStack } from '~/components/ui'

export function PostSiblingProductsRail({
  postId,
  listingId,
}: {
  postId: string
  listingId: string
}) {
  const communityUi = useCommunityUi()
  const [products, setProducts] = useState<PostProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchPostById(postId).then((result) => {
      if (cancelled) return
      const all = result.data?.products?.length
        ? result.data.products
        : result.data?.product
          ? [result.data.product]
          : []
      setProducts(all.filter((product) => product.listingId && product.listingId !== listingId))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [listingId, postId])

  const listingIds = useMemo(() => products.map((product) => product.listingId).join(','), [products])

  useEffect(() => {
    if (!products.length) return
    trackCommunityPostSiblingImpression({
      postId,
      listingId,
      source: 'post_detail',
    })
  }, [listingId, listingIds, postId, products.length])

  if (loading) {
    return (
      <YStack paddingVertical={12} alignItems="center">
        <Spinner size="small" color={communityUi.brand} />
      </YStack>
    )
  }

  if (!products.length) return null

  return (
    <YStack gap={10}>
      <Text fontSize={16} fontWeight="700" color={communityUi.text}>
        More from this post
      </Text>
      <PostProductStack products={products} postId={postId} source="post_detail" layout="carousel" />
    </YStack>
  )
}
