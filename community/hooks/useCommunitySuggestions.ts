import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchCommunitySuggestions,
  fetchPersonalizationProfile,
  SUGGESTION_SECTIONS,
  type CommunitySuggestion,
  type SuggestionKind,
  type SuggestionSectionMeta,
} from '~/community/lib/community-personalization'
import { fetchFollowedCompanyIds, fetchManagedCompanyIds } from '~/community/lib/companies'
import { fetchJoinedOrPendingGroupIds } from '~/community/lib/groups'
import { useFollowedShops } from '~/commerce/hooks/useFollowedShops'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import { useNetwork } from '~/community/hooks/useNetwork'
import { useProfile } from '~/hooks/useProfile'
import { commerceRoutes } from '~/lib/routes'
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
/** Bump when suggestion item shape or formatting changes so clients refetch. */
const SUGGESTIONS_CACHE_VERSION = 3
let suggestionsFetchedAt = 0
let suggestionsCacheVersion = 0
let suggestionsCacheKey = ''
let suggestionsCache: Record<SuggestionKind, CommunitySuggestion[]> | null = null
let followedShopListingsCache: CommunitySuggestion[] | null = null

export function useCommunitySuggestions(perKindLimit = 4, options?: { deferUntilIdle?: boolean }) {
  const deferUntilIdle = options?.deferUntilIdle ?? true
  const { user } = useSupabase()
  const { profile } = useProfile()
  const network = useNetwork()
  const followedShops = useFollowedShops(perKindLimit)
  const geo = useUserGeo(profile?.location)
  const [ready, setReady] = useState(!deferUntilIdle)
  const [byKind, setByKind] = useState<Record<SuggestionKind, CommunitySuggestion[]>>(
    () => suggestionsCache ?? emptyByKind(),
  )
  const [isLoading, setIsLoading] = useState(!suggestionsCache)
  const [error, setError] = useState<string | null>(null)
  const [followedShopListings, setFollowedShopListings] = useState<CommunitySuggestion[]>(
    () => followedShopListingsCache ?? [],
  )
  const networkRef = useRef(network)
  networkRef.current = network

  useEffect(() => {
    if (!deferUntilIdle) return
    return scheduleIdle(() => setReady(true))
  }, [deferUntilIdle])

  const load = useCallback(
    async (force = false) => {
      if (!ready) return
      const cacheKey = JSON.stringify({
        userId: user?.id ?? 'guest',
        perKindLimit,
        followedShopIds: followedShops.ids,
        industry: profile?.industry ?? null,
        occupation: profile?.occupation ?? null,
        location: profile?.location ?? null,
        geo,
      })
      if (
        !force &&
        suggestionsCache &&
        suggestionsCacheKey === cacheKey &&
        suggestionsCacheVersion === SUGGESTIONS_CACHE_VERSION &&
        Date.now() - suggestionsFetchedAt < SUGGESTIONS_FRESH_MS
      ) {
        setByKind(suggestionsCache)
        setFollowedShopListings(followedShopListingsCache ?? [])
        setIsLoading(false)
        return
      }

      if (!suggestionsCache) setIsLoading(true)

      const net = networkRef.current
      const [extra, followedCompanyIds, managedCompanyIds, relatedGroupIds] = await Promise.all([
        user ? fetchPersonalizationProfile(user.id) : Promise.resolve(null),
        user ? fetchFollowedCompanyIds(user.id) : Promise.resolve([]),
        user ? fetchManagedCompanyIds(user.id) : Promise.resolve(new Set<string>()),
        user ? fetchJoinedOrPendingGroupIds(user.id) : Promise.resolve([]),
      ])
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
          followedShopIds: followedShops.idSet,
          excludeCompanyIds: new Set([...followedCompanyIds, ...managedCompanyIds]),
          excludeGroupIds: new Set(relatedGroupIds),
        },
        { perKindLimit },
      )

      suggestionsCache = result.byKind
      suggestionsCacheKey = cacheKey
      followedShopListingsCache = result.followedShopListings
      suggestionsCacheVersion = SUGGESTIONS_CACHE_VERSION
      suggestionsFetchedAt = Date.now()
      setByKind(result.byKind)
      setFollowedShopListings(result.followedShopListings)
      setError(result.error)
      setIsLoading(false)
    },
    [
      followedShops.idSet,
      geo,
      perKindLimit,
      profile?.industry,
      profile?.location,
      profile?.occupation,
      ready,
      user,
    ],
  )

  useEffect(() => {
    void load(false)
    // Intentionally omit `load` identity — refresh when profile/user/ready changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    user?.id,
    profile?.industry,
    profile?.occupation,
    profile?.location,
    perKindLimit,
    geo,
    followedShops.ids.join(','),
  ])

  const sections = useMemo<SuggestionSection[]>(
    () =>
      [
        ...(followedShopListings.length
          ? [
              {
                kind: 'listing' as const,
                title: 'From shops you follow',
                seeAllHref: String(commerceRoutes.shops),
                items: followedShopListings,
              },
            ]
          : []),
        ...SUGGESTION_SECTIONS.map((section) => ({
          ...section,
          items: byKind[section.kind] ?? [],
        })),
      ].filter((section) => section.items.length > 0),
    [byKind, followedShopListings],
  )

  const refresh = useCallback(() => load(true), [load])

  return {
    sections,
    byKind,
    followedShopListings,
    isLoading: !ready || isLoading || followedShops.isLoading,
    error,
    refresh,
  }
}
