import { useEffect, useRef } from 'react'

import { trackCommunityPostPdpLanding } from '~/community/lib/community-commerce-analytics'
import type { CommunityCommerceSource } from '~/community/lib/community-commerce-analytics'
import { useQueryParam } from '~/hooks/useQueryParams'

function parseAttributionSource(value: string | null): CommunityCommerceSource | 'feed' {
  if (
    value === 'composer' ||
    value === 'feed' ||
    value === 'post_detail' ||
    value === 'profile' ||
    value === 'profile_shop' ||
    value === 'pdp' ||
    value === 'pdp_share' ||
    value === 'chat' ||
    value === 'followed_shop'
  ) {
    return value
  }
  return 'feed'
}

/** Fire once when a listing PDP opens with community attribution query params. */
export function useCommunityListingAttribution(listingId?: string | null) {
  const ref = useQueryParam('ref')
  const postId = useQueryParam('postId')
  const sourceParam = useQueryParam('source')
  const trackedRef = useRef(false)
  const fromCommunityPost = ref === 'community' && !!postId
  const attributionSource = parseAttributionSource(sourceParam)

  useEffect(() => {
    if (trackedRef.current || !listingId) return
    if (!fromCommunityPost && ref !== 'community') return
    trackedRef.current = true
    trackCommunityPostPdpLanding({
      postId: postId ?? undefined,
      listingId,
      source: fromCommunityPost ? attributionSource : 'pdp',
      ref: 'community',
    })
  }, [attributionSource, fromCommunityPost, listingId, postId, ref])

  return { fromCommunityPost, communityPostId: postId, attributionSource }
}
