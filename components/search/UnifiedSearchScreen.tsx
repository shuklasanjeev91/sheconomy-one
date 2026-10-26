import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ListingBrowseView, ListingFiltersShell, ListingGrid, ShopGrid } from '~/commerce/components'
import { fetchListingsByIds, type ListingSummary, type ShopSummary } from '~/commerce/lib/commerce'
import { fetchProfilesByIds, type PublicProfile } from '~/community/lib/network'
import { useSearchListings } from '~/commerce/hooks/useSearchListings'
import { useSponsoredCommerce } from '~/commerce/hooks/useSponsoredCommerce'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
} from '~/commerce/lib/filters'
import {
  clearSearchHistory,
  recordSearchTerm,
  removeSearchTerm,
  useSearchHistory,
} from '~/commerce/lib/search-history'
import { SearchHitRow } from '~/components/search/SearchHitRow'
import { AppLink } from '~/components/navigation/AppLink'
import { FullWidthLayout, HorizontalScrollRow, PageSection } from '~/components/layout'
import { Avatar, Button, EmptyState, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { countActiveFilters, hasActiveFilters } from '~/commerce/lib/filters'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import {
  availableSearchScopes,
  canAccessSearchScope,
  federatedSearch,
  isShopSetupQuestion,
  isTripListingText,
  isWeekendPlanQuery,
  runAiSearch,
  SEARCH_SCOPE_LABELS,
  searchScopeGateHref,
  type FederatedSearchResult,
  type SearchHit,
  type SearchScope,
} from '~/lib/search'
import type { AiEntityHit, AiResultKind, AiSearchGroup } from '~/lib/ai/types'
import { getPublicShops } from '~/lib/shop/shop.service'
import { appRoutes, commerceRoutes, vendorRoutes } from '~/lib/routes'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'
import { AI_NAME } from '~/config/brand'
import { useAppUi } from '~/lib/theme/useAppUi'

type UnifiedSearchScreenProps = {
  query?: string
  scope?: SearchScope
  filters?: ListingBrowseFilters
  mode?: 'ai' | null
}

type SectionKey =
  | 'listings'
  | 'categories'
  | 'shops'
  | 'people'
  | 'companies'
  | 'groups'
  | 'jobs'
  | 'posts'
  | 'programs'
  | 'meetings'

const SECTION_META: Array<{
  key: SectionKey
  scope: SearchScope
  title: string
  pick: (result: FederatedSearchResult) => SearchHit[]
}> = [
  { key: 'listings', scope: 'listings', title: 'Listings', pick: (r) => r.listings },
  { key: 'categories', scope: 'categories', title: 'Categories', pick: (r) => r.categories },
  { key: 'shops', scope: 'shops', title: 'Shops', pick: (r) => r.shops },
  { key: 'people', scope: 'people', title: 'People', pick: (r) => r.people },
  { key: 'companies', scope: 'companies', title: 'Companies', pick: (r) => r.companies },
  { key: 'groups', scope: 'groups', title: 'Groups', pick: (r) => r.groups },
  { key: 'jobs', scope: 'jobs', title: 'Jobs', pick: (r) => r.jobs },
  { key: 'posts', scope: 'posts', title: 'Posts', pick: (r) => r.posts },
  { key: 'programs', scope: 'programs', title: 'Programs', pick: (r) => r.programs },
  { key: 'meetings', scope: 'meetings', title: 'Meetings', pick: (r) => r.meetings },
]

function entityHitToSearchHit(hit: AiEntityHit): SearchHit | null {
  const base = {
    id: hit.id,
    title: hit.title,
    subtitle: hit.subtitle || null,
    imageUrl: null,
    href: hit.href,
  }
  switch (hit.kind) {
    case 'job':
      return { ...base, kind: 'job', companyName: hit.subtitle, location: '' }
    case 'post':
      return { ...base, kind: 'post' }
    case 'program':
      return { ...base, kind: 'program', slug: hit.id }
    case 'company':
      return { ...base, kind: 'company', slug: hit.id }
    case 'meeting':
      return { ...base, kind: 'meeting', code: '' }
    case 'person':
      return { ...base, kind: 'person', username: null }
    case 'shop':
      return { ...base, kind: 'shop', slug: null }
    default:
      return null
  }
}

export function UnifiedSearchScreen({
  query: queryProp = '',
  scope: scopeProp = 'all',
  filters: initialFilters = {},
  mode: modeProp = null,
}: UnifiedSearchScreenProps) {
  const ui = useAppUi()
  const { listingGridColumns } = useAppLayout()
  const { tier } = useAccess()
  const { user, profile } = useProfile()
  const userGeo = useUserGeo(profile?.location)
  const history = useSearchHistory()
  const query = queryProp.trim()
  const aiMode = modeProp === 'ai'
  const scope = aiMode ? 'listings' : scopeProp
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSearchTerm, setAiSearchTerm] = useState<string | null>(null)
  const [aiFilters, setAiFilters] = useState<ListingBrowseFilters>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiListingIds, setAiListingIds] = useState<string[]>([])
  const [aiGroups, setAiGroups] = useState<AiSearchGroup[]>([])
  const [aiListings, setAiListings] = useState<ListingSummary[]>([])
  const [aiListingsLoading, setAiListingsLoading] = useState(false)
  const [aiResultKind, setAiResultKind] = useState<AiResultKind>('listing')
  const [aiEntityIds, setAiEntityIds] = useState<string[]>([])
  const [aiHits, setAiHits] = useState<AiEntityHit[]>([])
  const [aiProfiles, setAiProfiles] = useState<PublicProfile[]>([])
  const [aiShops, setAiShops] = useState<ShopSummary[]>([])
  const [aiEntitiesLoading, setAiEntitiesLoading] = useState(false)

  const filters = useMemo(
    () => (aiMode ? { ...initialFilters, ...aiFilters } : initialFilters),
    [aiMode, initialFilters, aiFilters],
  )
  const scopes = availableSearchScopes(tier)

  const [result, setResult] = useState<FederatedSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefer the original typed query when AI pads a brand/shop name with fluff —
  // search_listings matches tokens, but keeping the shop name first ranks better.
  const effectiveListingQuery = aiMode
    ? (aiSearchTerm?.trim() || query)
    : query
  const preferAiProducts =
    aiMode && aiListingIds.length > 0 && (aiListingsLoading || aiListings.length > 0)
  const listingsBrowseEnabled =
    scope === 'listings' &&
    effectiveListingQuery.length > 0 &&
    !preferAiProducts &&
    !(aiMode && (aiLoading || aiResultKind !== 'listing'))
  const listingsFeed = useSearchListings({
    query: effectiveListingQuery,
    filters,
    enabled: listingsBrowseEnabled,
  })
  const sponsoredListings = useSponsoredCommerce({
    placement: 'commerce_search',
    context: {
      query: effectiveListingQuery,
    },
    enabled: listingsBrowseEnabled,
    limit: 2,
  })

  const filterKey = useMemo(
    () => JSON.stringify({ filters, term: effectiveListingQuery, aiMode }),
    [filters, effectiveListingQuery, aiMode],
  )

  useEffect(() => {
    if (query) recordSearchTerm(query)
  }, [query])

  useEffect(() => {
    if (!aiMode || !query) {
      setAiAnswer(null)
      setAiSearchTerm(null)
      setAiFilters({})
      setAiListingIds([])
      setAiGroups([])
      setAiListings([])
      setAiResultKind('listing')
      setAiEntityIds([])
      setAiHits([])
      setAiProfiles([])
      setAiShops([])
      setAiLoading(false)
      setAiError(null)
      return
    }

    let cancelled = false
    setAiLoading(true)
    setAiError(null)
    void runAiSearch(query, profile?.location)
      .then((next) => {
        if (cancelled) return
        setAiAnswer(next.answer)
        setAiSearchTerm(next.searchTerm)
        setAiFilters(next.filters)
        setAiListingIds(next.listingIds)
        setAiGroups(next.groups ?? [])
        setAiResultKind(next.resultKind ?? 'listing')
        setAiEntityIds(next.entityIds ?? [])
        setAiHits(next.hits ?? [])
        setAiLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAiError(
          err instanceof Error
            ? /unauthorized/i.test(err.message)
              ? 'Sign in to ask about your own orders or shop.'
              : err.message
            : 'AI search failed',
        )
        setAiSearchTerm(query)
        setAiFilters({})
        setAiListingIds([])
        setAiGroups([])
        setAiResultKind('listing')
        setAiEntityIds([])
        setAiHits([])
        setAiLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [aiMode, query, profile?.location])

  const aiListingKey = aiListingIds.join(',')
  useEffect(() => {
    if (!aiListingKey) {
      setAiListings([])
      setAiListingsLoading(false)
      return
    }
    let cancelled = false
    setAiListingsLoading(true)
    void fetchListingsByIds(aiListingIds)
      .then((rows) => {
        if (cancelled) return
        const visible = isWeekendPlanQuery(query)
          ? rows.filter((listing) =>
              isTripListingText(`${listing.title} ${listing.category ?? ''} ${listing.shop_name ?? ''}`),
            )
          : rows
        setAiListings(visible)
        setAiListingsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setAiListings([])
        setAiListingsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [aiListingKey, aiListingIds, query])

  const aiEntityKey = `${aiResultKind}:${aiEntityIds.join(',')}`
  useEffect(() => {
    if ((aiResultKind !== 'person' && aiResultKind !== 'shop') || aiEntityIds.length === 0) {
      setAiProfiles([])
      setAiShops([])
      setAiEntitiesLoading(false)
      return
    }
    let cancelled = false
    setAiEntitiesLoading(true)
    const load =
      aiResultKind === 'person'
        ? fetchProfilesByIds(aiEntityIds).then((rows) => {
            if (cancelled) return
            setAiProfiles(rows)
            setAiShops([])
          })
        : getPublicShops({ shopIds: aiEntityIds }, { limit: aiEntityIds.length }).then((res) => {
            if (cancelled) return
            const byId = new Map((res.data?.items ?? []).map((shop) => [shop.id, shop]))
            setAiShops(
              aiEntityIds
                .map((id) => byId.get(id))
                .filter((shop): shop is ShopSummary => !!shop),
            )
            setAiProfiles([])
          })
    void load
      .catch(() => {
        if (cancelled) return
        setAiProfiles([])
        setAiShops([])
      })
      .finally(() => {
        if (!cancelled) setAiEntitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [aiEntityKey, aiResultKind, aiEntityIds])

  useEffect(() => {
    if (!query || scope === 'listings') {
      setResult(null)
      setLoading(false)
      setError(null)
      return
    }

    if (!canAccessSearchScope(tier, scope) && scope !== 'all') {
      setResult(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void federatedSearch(query, {
      scope,
      limitPerScope: scope === 'all' ? 6 : 24,
      tier,
      userId: user?.id,
      latitude: userGeo.latitude,
      longitude: userGeo.longitude,
      memberLocation: profile?.location,
    }).then((next) => {
      if (cancelled) return
      setResult(next)
      setLoading(false)
    }).catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Search failed')
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [query, scope, tier, user?.id, userGeo.latitude, userGeo.longitude, profile?.location])

  function setScope(next: SearchScope) {
    const params = buildFilterSearchParams(
      new URLSearchParams(),
      scope === 'listings' ? filters : {},
    )
    if (query) params.set('q', query)
    if (next !== 'all') params.set('scope', next)
    // Leaving AI mode when switching scopes.
    params.delete('mode')
    const search = params.toString()
    replaceApp((search ? `${appRoutes.search()}?${search}` : appRoutes.search()) as never)
  }

  function updateFilters(next: ListingBrowseFilters) {
    const params = buildFilterSearchParams(new URLSearchParams(), next)
    if (query) params.set('q', query)
    params.set('scope', 'listings')
    if (aiMode) params.set('mode', 'ai')
    const search = params.toString()
    replaceApp((search ? `/search?${search}` : '/search?scope=listings') as never)
  }

  function runHistoryTerm(term: string) {
    recordSearchTerm(term)
    navigateApp(appRoutes.search(term, scope) as never)
  }

  const gated = scope !== 'all' && !canAccessSearchScope(tier, scope)

  const visibleSections = SECTION_META.filter(
    (section) => scope === 'all' || scope === section.scope,
  )

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" gap="$4">
        <YStack gap="$3" width="100%">
          <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            {aiMode && query
              ? `AI results for “${query}”`
              : query
                ? `Results for “${query}”`
                : 'Search'}
          </Text>

          {query && isShopSetupQuestion(query) ? (
            <YStack
              gap="$2"
              padding="$3.5"
              borderRadius={14}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Text fontSize={16} fontWeight="800" color={ui.text}>
                Create a shop
              </Text>
              <Text fontSize={14} color={ui.text} lineHeight={21}>
                Open Create shop from the menu, or go to Create shop. Sign in first. If verification is still pending, finish it, then continue. After the shop exists, manage it from Manage shop.
              </Text>
              <XStack gap="$3" flexWrap="wrap">
                <AppLink href={commerceRoutes.createShop}>
                  <Text fontSize={14} fontWeight="700" color={ui.brand}>
                    Create shop
                  </Text>
                </AppLink>
                <AppLink href={vendorRoutes.myShop}>
                  <Text fontSize={14} fontWeight="700" color={ui.brand}>
                    Manage shop
                  </Text>
                </AppLink>
              </XStack>
            </YStack>
          ) : null}

          {aiMode && query ? (
            <YStack
              gap="$2"
              padding="$3.5"
              borderRadius={14}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <XStack alignItems="center" gap="$2">
                <Icons.Sparkles size={16} color={ui.brand} />
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  Ask {AI_NAME}
                </Text>
              </XStack>
              {aiLoading ? (
                <XStack alignItems="center" gap="$2">
                  <Spinner size="small" />
                  <Text fontSize={13} color={ui.textSecondary}>
                    Understanding your request…
                  </Text>
                </XStack>
              ) : null}
              {aiError ? (
                <Text fontSize={13} color={ui.danger}>
                  {aiError}
                </Text>
              ) : null}
              {!aiLoading && (aiListingsLoading || aiEntitiesLoading) ? (
                <XStack alignItems="center" gap="$2">
                  <Spinner size="small" />
                  <Text fontSize={13} color={ui.textSecondary}>
                    {aiResultKind === 'person'
                      ? 'Loading profiles…'
                      : aiResultKind === 'shop'
                        ? 'Loading shops…'
                        : 'Loading products…'}
                  </Text>
                </XStack>
              ) : null}
              {!aiLoading && aiResultKind === 'person' && aiProfiles.length > 0 ? (
                <YStack gap="$3" width="100%">
                  <Text fontSize={14} color={ui.textSecondary}>
                    People
                  </Text>
                  <XStack gap="$3" flexWrap="wrap" width="100%">
                    {aiProfiles.map((profile) => {
                      const name = profile.full_name?.trim() || profile.username
                      const detail = [profile.headline, profile.occupation].filter(Boolean).join(' · ')
                      return (
                        <AppLink key={profile.id} href={appRoutes.userProfile(profile.username)} asChild>
                          <YStack
                            width={168}
                            gap="$2"
                            padding="$3"
                            borderRadius={14}
                            borderWidth={1}
                            borderColor={ui.borderSubtle}
                            backgroundColor={ui.surface}
                            cursor="pointer"
                          >
                            <Avatar name={name} src={profile.avatar_url ?? undefined} size="$6" />
                            <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
                              {name}
                            </Text>
                            {detail ? (
                              <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
                                {detail}
                              </Text>
                            ) : null}
                          </YStack>
                        </AppLink>
                      )
                    })}
                  </XStack>
                </YStack>
              ) : null}
              {!aiLoading && aiResultKind === 'shop' && aiShops.length > 0 ? (
                <YStack gap="$3" width="100%">
                  <Text fontSize={14} color={ui.textSecondary}>
                    Shops
                  </Text>
                  <ShopGrid shops={aiShops} columns={listingGridColumns} />
                </YStack>
              ) : null}
              {!aiLoading &&
              !aiEntitiesLoading &&
              (aiResultKind === 'person' || aiResultKind === 'shop') &&
              aiProfiles.length === 0 &&
              aiShops.length === 0 &&
              aiHits.length > 0 ? (
                <YStack gap="$2" width="100%">
                  {aiHits.map((hit) => {
                    const mapped = entityHitToSearchHit(hit)
                    return mapped ? <SearchHitRow key={`${hit.kind}-${hit.id}`} hit={mapped} /> : null
                  })}
                </YStack>
              ) : null}
              {!aiLoading &&
              aiResultKind !== 'listing' &&
              aiResultKind !== 'person' &&
              aiResultKind !== 'shop' &&
              aiHits.length > 0 ? (
                <YStack gap="$2" width="100%">
                  {aiAnswer ? (
                    <Text fontSize={14} color={ui.text} lineHeight={21}>
                      {aiAnswer}
                    </Text>
                  ) : null}
                  {aiHits.map((hit) => {
                    const mapped = entityHitToSearchHit(hit)
                    return mapped ? (
                      <SearchHitRow key={`${hit.kind}-${hit.id}`} hit={mapped} />
                    ) : (
                      <AppLink key={`${hit.kind}-${hit.id}`} href={hit.href as never}>
                        <Text fontSize={14} fontWeight="700" color={ui.text}>
                          {hit.title}
                        </Text>
                      </AppLink>
                    )
                  })}
                </YStack>
              ) : null}
              {!aiLoading && aiResultKind === 'listing' && aiListings.length > 0 && aiGroups.length > 0 ? (
                <YStack gap="$4" width="100%">
                  <Text fontSize={14} color={ui.textSecondary}>
                    Outfits by wedding function
                  </Text>
                  {aiGroups.map((group) => {
                    const cards = group.listingIds
                      .map((id) => aiListings.find((listing) => listing.id === id))
                      .filter((listing): listing is ListingSummary => !!listing)
                    if (!cards.length) return null
                    return (
                      <YStack key={group.label} gap="$2" width="100%">
                        <Text fontSize={16} fontWeight="800" color={ui.text}>
                          {group.label}
                        </Text>
                        <ListingGrid
                          listings={cards}
                          columns={listingGridColumns}
                          personalize={false}
                          showQuickAdd
                        />
                      </YStack>
                    )
                  })}
                </YStack>
              ) : null}
              {!aiLoading && aiResultKind === 'listing' && aiListings.length > 0 && aiGroups.length === 0 ? (
                <YStack gap="$2" width="100%">
                  <Text fontSize={14} color={ui.text} lineHeight={21}>
                    {aiAnswer || `Products for “${aiSearchTerm || query}”`}
                  </Text>
                  <ListingGrid
                    listings={aiListings}
                    columns={listingGridColumns}
                    personalize={false}
                    showQuickAdd
                  />
                </YStack>
              ) : null}
              {!aiLoading &&
              !aiListingsLoading &&
              !aiEntitiesLoading &&
              aiListings.length === 0 &&
              aiProfiles.length === 0 &&
              aiShops.length === 0 &&
              aiHits.length === 0 &&
              aiAnswer ? (
                <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                  {aiAnswer}
                </Text>
              ) : null}
              {!aiLoading &&
              aiResultKind === 'listing' &&
              aiListings.length === 0 &&
              aiSearchTerm &&
              aiSearchTerm !== query ? (
                <Text fontSize={12} color={ui.textMuted}>
                  Searching listings for “{aiSearchTerm}”
                </Text>
              ) : null}
            </YStack>
          ) : null}

          <HorizontalScrollRow gap="$2">
            {scopes.map((item) => {
              const active = item === scope
              return (
                <XStack
                  key={item}
                  paddingHorizontal="$3.5"
                  paddingVertical="$2.5"
                  minHeight={44}
                  alignItems="center"
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.brand : ui.surface}
                  cursor="pointer"
                  onPress={() => setScope(item)}
                  pressStyle={{ opacity: 0.9 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search scope ${SEARCH_SCOPE_LABELS[item]}`}
                  accessibilityState={{ selected: active }}
                  testID={`search-scope-${item}`}
                >
                  <Text
                    fontSize={13}
                    fontWeight="700"
                    color={active ? ui.onBrand : ui.text}
                  >
                    {SEARCH_SCOPE_LABELS[item]}
                  </Text>
                </XStack>
              )
            })}
          </HorizontalScrollRow>
          {scope === 'listings' && hasActiveFilters(filters) ? (
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              <Text fontSize={13} color={ui.textMuted}>
                {countActiveFilters(filters)} active filter
                {countActiveFilters(filters) === 1 ? '' : 's'}
              </Text>
              <Button
                size="$3"
                tone="ghost"
                borderRadius={999}
                minHeight={44}
                onPress={() => updateFilters({})}
                accessibilityLabel="Clear filters"
                testID="clear-search-filters"
              >
                Clear filters
              </Button>
            </XStack>
          ) : null}
        </YStack>

        {gated ? (
          <YStack gap="$3" paddingVertical="$6" alignItems="flex-start">
            <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
              {tier === 'guest'
                ? 'Sign in to search this area.'
                : 'Verify your account to search this area.'}
            </Text>
            <Button
              borderRadius={999}
              backgroundColor={ui.brand}
              color={ui.onBrand}
              onPress={() => replaceApp(searchScopeGateHref(tier, scope))}
            >
              {tier === 'guest' ? 'Sign in' : 'Verify gender'}
            </Button>
          </YStack>
        ) : null}

        {!gated && !query ? (
          <YStack gap="$4" width="100%">
            <Text fontSize={14} color={ui.textSecondary}>
              Search listings, shops, people, companies, groups, jobs, posts, programs, and
              meetings. Use the camera, mic, or Ask {AI_NAME} in the search bar.
            </Text>
            {history.length > 0 ? (
              <YStack gap="$3" width="100%">
                <XStack alignItems="center" justifyContent="space-between" gap="$2">
                  <Text fontSize={15} fontWeight="700" color={ui.text}>
                    Recent searches
                  </Text>
                  <Text
                    fontSize={13}
                    fontWeight="600"
                    color={ui.textMuted}
                    cursor="pointer"
                    onPress={() => clearSearchHistory()}
                  >
                    Clear
                  </Text>
                </XStack>
                <HorizontalScrollRow gap="$2">
                  {history.map((term) => (
                    <XStack
                      key={term}
                      alignItems="center"
                      gap="$2"
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius={999}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      backgroundColor={ui.surface}
                      cursor="pointer"
                      onPress={() => runHistoryTerm(term)}
                    >
                      <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                        {term}
                      </Text>
                      <Text
                        fontSize={12}
                        color={ui.textMuted}
                        onPress={() => removeSearchTerm(term)}
                      >
                        ×
                      </Text>
                    </XStack>
                  ))}
                </HorizontalScrollRow>
              </YStack>
            ) : null}
            <Button
              alignSelf="flex-start"
              tone="outline"
              borderRadius={999}
              onPress={() => navigateApp(commerceRoutes.favorites as never)}
            >
              Open wishlist
            </Button>
          </YStack>
        ) : null}

        {!gated && query && listingsBrowseEnabled ? (
          <ListingFiltersShell filters={filters} onApply={updateFilters}>
            <ListingBrowseView
              key={filterKey}
              title="Listing results"
              subtitle={
                !listingsFeed.isLoading &&
                listingsFeed.items.length > 0
                  ? `${listingsFeed.items.length}${listingsFeed.hasMore ? '+' : ''} listings`
                  : undefined
              }
              items={listingsFeed.items}
              isLoading={listingsFeed.isLoading && listingsFeed.items.length === 0}
              isLoadingMore={listingsFeed.isLoadingMore}
              hasMore={listingsFeed.hasMore}
              error={listingsFeed.error}
              onLoadMore={listingsFeed.loadMore}
              onRetry={listingsFeed.refresh}
              sponsoredItems={sponsoredListings.items}
              onSponsoredEvent={(item, event) => void sponsoredListings.track(item, event)}
              emptyMessage={
                aiLoading
                  ? 'Finding matches…'
                  : `No listing results for “${effectiveListingQuery || query}”.`
              }
            />
          </ListingFiltersShell>
        ) : null}

        {!gated && query && scope !== 'listings' ? (
          <YStack gap="$5" width="100%" minHeight={200}>
            {loading ? (
              <YStack paddingVertical="$8" alignItems="center">
                <Spinner size="large" />
              </YStack>
            ) : null}
            {error ? (
              <Text color={ui.danger}>{error}</Text>
            ) : null}
            {!loading && result ? (
              <>
                {visibleSections.map((section) => {
                  const hits = section.pick(result)
                  if (!hits.length) return null
                  return (
                    <ResultSection
                      key={section.key}
                      title={section.title}
                      onSeeAll={scope === 'all' ? () => setScope(section.scope) : undefined}
                    >
                      {hits.map((hit) => (
                        <SearchHitRow key={`${hit.kind}-${hit.id}`} hit={hit} />
                      ))}
                    </ResultSection>
                  )
                })}
                {!loading &&
                visibleSections.every((section) => section.pick(result).length === 0) ? (
                  <EmptyState
                    title={`No results for “${query}”`}
                    message="Try another keyword, switch scope, or clear filters. Recent searches above can help you restart quickly."
                    actionLabel="Search all"
                    onAction={() => setScope('all')}
                  />
                ) : null}
              </>
            ) : null}
          </YStack>
        ) : null}
      </PageSection>
    </FullWidthLayout>
  )
}

function ResultSection({
  title,
  children,
  onSeeAll,
}: {
  title: string
  children: ReactNode
  onSeeAll?: () => void
}) {
  const ui = useAppUi()
  return (
    <YStack gap="$2" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          {title}
        </Text>
        {onSeeAll ? (
          <Text
            fontSize={13}
            fontWeight="600"
            color={ui.brand}
            cursor="pointer"
            onPress={onSeeAll}
          >
            See all
          </Text>
        ) : null}
      </XStack>
      <YStack gap="$1" width="100%">
        {children}
      </YStack>
    </YStack>
  )
}
