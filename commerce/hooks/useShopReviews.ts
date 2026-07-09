import { useEffect, useMemo, useState } from 'react'

import {
  fetchShopReviews,
  mergeReviewSummary,
  type PublicReview,
  type ReviewSummary,
} from '~/commerce/lib/reviews'

export function useShopReviews(
  shopId?: string,
  stored?: { averageRating?: number | null; totalReviews?: number | null },
) {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [computed, setComputed] = useState<ReviewSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!shopId) {
      setReviews([])
      setComputed(null)
      return
    }

    let active = true
    setIsLoading(true)
    setError(null)

    fetchShopReviews(shopId).then((result) => {
      if (!active) return
      setReviews(result.reviews)
      setComputed(result.summary)
      setError(result.error)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [shopId])

  const summary = useMemo(() => {
    if (!computed) {
      return mergeReviewSummary(
        {
          averageRating: stored?.averageRating,
          totalReviews: stored?.totalReviews,
        },
        { averageRating: null, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      )
    }

    return mergeReviewSummary(
      {
        averageRating: stored?.averageRating,
        totalReviews: stored?.totalReviews,
      },
      computed,
    )
  }, [computed, stored?.averageRating, stored?.totalReviews])

  return { reviews, summary, isLoading, error }
}
