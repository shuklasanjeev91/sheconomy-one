import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { scheduleIdle } from '~/lib/schedule-idle'
import { useSupabase } from '~/providers/SupabaseProvider'

export type SuggestionSection = SuggestionSectionMeta & {
  items: CommunitySuggestion[]
}

const emptyByKind = (): Record<SuggestionKind, CommunitySuggestion[]> => ({
  person: [],
  listing: [],
  shop: [],
  company: [],
  group: [],
  job: [],
  event: [],
})

const SUGGESTIONS_FRESH_MS = 60_000
let suggestionsFetchedAt = 0
let suggestionsCache: Record<SuggestionKind, CommunitySuggestion[]> | null = null

export function useCommunitySuggestions(perKindLimit = 4, options?: { deferUntilIdle?: boolean }) {
  const deferUntilIdle = options?.deferUntilIdle ?? true
  const { user } = useSupabase()
  const { profile } = useProfile()
  const network = useNetwork()
  const geo = useUserGeo(profile?.location)
  const [ready, setReady] = useState(!deferUntilIdle)
  const [byKind, setByKind] = useState<Record<SuggestionKind, CommunitySuggestion[]>>(
    () => suggestionsCache ?? emptyByKind(),
  )
  const [isLoading, setIsLoading] = useState(!suggestionsCache)
  const [error, setError] = useState<string | null>(null)
  const networkRef = useRef(network)
  networkRef.current = network

  useEffect(() => {
    if (!deferUntilIdle) return
    return scheduleIdle(() => setReady(true))
  }, [deferUntilIdle])

  const load = useCallback(
    async (force = false) => {
      if (!ready) return
      if (
        !force &&
        suggestionsCache &&
        Date.now() - suggestionsFetchedAt < SUGGESTIONS_FRESH_MS
      ) {
        setByKind(suggestionsCache)
        setIsLoading(false)
        return
      }

      if (!suggestionsCache) setIsLoading(true)

      const net = networkRef.current
      const extra = user ? await fetchPersonalizationProfile(user.id) : null
      const connectionIds = new Set(net.connections.map((member) => member.user_id))
      const pendingIds = new Set([
        ...net.pendingReceived.map((member) => member.user_id),
        ...net.pendingSent.map((member) => member.user_id),
      ])

      const result = await fetchCommunitySuggestions(
        {
          userId: user?.id,
          industry: extra?.industry ?? profile?.industry ?? null,
          occupation: extra?.occupation ?? profile?.occupation ?? null,
          interests: extra?.interests ?? null,
          location: extra?.location ?? profile?.location ?? null,
          geo,
          networkSuggestions: net.suggestions,
          excludeUserIds: new Set([...connectionIds, ...pendingIds, ...(user ? [user.id] : [])]),
        },
        { perKindLimit },
      )

      suggestionsCache = result.byKind
      suggestionsFetchedAt = Date.now()
      setByKind(result.byKind)
      setError(result.error)
      setIsLoading(false)
    },
    [geo, perKindLimit, profile?.industry, profile?.location, profile?.occupation, ready, user],
  )

  useEffect(() => {
    void load(false)
    // Intentionally omit `load` identity — refresh when profile/user/ready changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id, profile?.industry, profile?.occupation, profile?.location, perKindLimit, geo])

  const sections = useMemo<SuggestionSection[]>(
    () =>
      SUGGESTION_SECTIONS.map((section) => ({
        ...section,
        items: byKind[section.kind] ?? [],
      })).filter((section) => section.items.length > 0),
    [byKind],
  )

  const refresh = useCallback(() => load(true), [load])

  return { sections, byKind, isLoading: !ready || isLoading, error, refresh }
}
