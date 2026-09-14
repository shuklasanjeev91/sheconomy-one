import { useEffect, useState } from 'react'

import { CommerceSection } from '~/commerce/components/CommerceSection'
import { ListingCarouselRow } from '~/commerce/components/ListingCarouselRow'
import { fetchForYouListings } from '~/commerce/lib/listing-recommendations'
import type { ListingSummary } from '~/commerce/lib/commerce'
import { PageSection } from '~/components/layout'
import { commerceRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

export function ForYouHomeRail({ inset = false }: { inset?: boolean }) {
  const { user } = useSupabase()
  const [listings, setListings] = useState<ListingSummary[]>([])

  useEffect(() => {
    let active = true
    void fetchForYouListings(12).then((items) => {
      if (active) setListings(items)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  if (!listings.length) return null

  const body = (
    <CommerceSection
      title="For you"
      subtitle="Ranked from what you browse, buy, and save"
      actionLabel="See more"
      actionHref={commerceRoutes.browse('featured')}
    >
      <ListingCarouselRow listings={listings} />
    </CommerceSection>
  )

  return inset ? <PageSection>{body}</PageSection> : body
}
