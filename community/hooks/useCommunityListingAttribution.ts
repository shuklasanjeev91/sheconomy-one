import { useEffect, useRef } from 'react'

import { trackCommunityPostPdpLanding } from '~/community/lib/community-commerce-analytics'
import { useQueryParam } from '~/hooks/useQueryParams'

/** Fire once when a listing PDP opens with community attribution query params. */
export function useCommunityListingAttribution(listingId?: string | null) {
  const ref = useQueryParam('ref')
  const postId = useQueryParam('postId')
  const trackedRef = useRef(false)
  const fromCommunityPost = ref === 'community' && !!postId

  useEffect(() => {
    if (trackedRef.current || !fromCommunityPost || !postId || !listingId) return
    trackedRef.current = true
    trackCommunityPostPdpLanding({
      postId,
      listingId,
      source: 'feed',
      ref: 'community',
    })
  }, [fromCommunityPost, listingId, postId])

  return { fromCommunityPost, communityPostId: postId }
}
