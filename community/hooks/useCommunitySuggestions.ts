import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchCommunitySuggestions,
  fetchPersonalizationProfile,
  SUGGESTION_SECTIONS,
  type CommunitySuggestion,
  type SuggestionKind,
  type SuggestionSectionMeta,
} from '~/community/lib/community-personalization'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import { useNetwork } from '~/community/hooks/useNetwork'
import { useProfile } from '~/hooks/useProfile'
import { useSupabase } from '~/providers/SupabaseProvider'

export type SuggestionSection = SuggestionSectionMeta & {
  items: CommunitySuggestion[]
}

export function useCommunitySuggestions(perKindLimit = 4) {
  const { user } = useSupabase()
  const { profile } = useProfile()
  const network = useNetwork()
  const geo = useUserGeo(profile?.location)
  const [byKind, setByKind] = useState<Record<SuggestionKind, CommunitySuggestion[]>>({
    person: [],
    listing: [],
    shop: [],
    company: [],
    group: [],
    job: [],
    event: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)

    const extra = user ? await fetchPersonalizationProfile(user.id) : null
    const connectionIds = new Set(network.connections.map((member) => member.user_id))
    const pendingIds = new Set([
      ...network.pendingReceived.map((member) => member.user_id),
      ...network.pendingSent.map((member) => member.user_id),
    ])

    const result = await fetchCommunitySuggestions(
      {
        userId: user?.id,
        industry: extra?.industry ?? profile?.industry ?? null,
        occupation: extra?.occupation ?? profile?.occupation ?? null,
        interests: extra?.interests ?? null,
        location: extra?.location ?? profile?.location ?? null,
        geo,
        networkSuggestions: network.suggestions,
        excludeUserIds: new Set([...connectionIds, ...pendingIds, ...(user ? [user.id] : [])]),
      },
      { perKindLimit },
    )

    setByKind(result.byKind)
    setError(result.error)
    setIsLoading(false)
  }, [
    geo,
    perKindLimit,
    network.connections,
    network.pendingReceived,
    network.pendingSent,
    network.suggestions,
    profile?.industry,
    profile?.location,
    profile?.occupation,
    user,
  ])

  useEffect(() => {
    load()
  }, [load])

  const sections = useMemo<SuggestionSection[]>(
    () =>
      SUGGESTION_SECTIONS.map((section) => ({
        ...section,
        items: byKind[section.kind] ?? [],
      })).filter((section) => section.items.length > 0),
    [byKind],
  )

  return { sections, byKind, isLoading, error, refresh: load }
}
