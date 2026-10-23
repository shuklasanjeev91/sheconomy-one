import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ListingBrowseView, ListingFiltersShell } from '~/commerce/components'
import { useSearchListings } from '~/commerce/hooks/useSearchListings'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import {
  buildFilterSearchParams,
  type ListingBrowseFilters,
  type SearchMode,
} from '~/commerce/lib/filters'
import {
  clearSearchHistory,
  recordSearchTerm,
  removeSearchTerm,
  useSearchHistory,
} from '~/commerce/lib/search-history'
import { SearchHitRow } from '~/components/search/SearchHitRow'
import { SheaiAskAgain, SheaiPrompt } from '~/components/search/SheaiPrompt'
import { SheaiResultsSection } from '~/components/search/SheaiResultsSection'
import { useSheaiRecommend } from '~/hooks/useSheaiRecommend'
import { FullWidthLayout, HorizontalScrollRow, PageSection } from '~/components/layout'
import { Button, EmptyState, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { countActiveFilters, hasActiveFilters } from '~/commerce/lib/filters'
import { useAccess } from '~/hooks/useAccess'
import { useProfile } from '~/hooks/useProfile'
import {
  availableSearchScopes,
  buildSheaiSearchHref,
  canAccessSearchScope,
  federatedSearch,
  runAiSearch,
  SEARCH_SCOPE_LABELS,
  searchScopeGateHref,
  type FederatedSearchResult,
  type SearchHit,
  type SearchScope,
} from '~/lib/search'
import { appRoutes, commerceRoutes } from '~/lib/routes'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

type UnifiedSearchScreenProps = {
  query?: string
  scope?: SearchScope
  filters?: ListingBrowseFilters
  mode?: SearchMode
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

export function UnifiedSearchScreen({
  query: queryProp = '',
  scope: scopeProp = 'all',
  filters: initialFilters = {},
  mode: modeProp = null,
}: UnifiedSearchScreenProps) {
  const ui = useAppUi()
  const { tier } = useAccess()
  const { user, profile } = useProfile()
  const userGeo = useUserGeo(profile?.location)
  const history = useSearchHistory()
  const query = queryProp.trim()
  const aiMode = modeProp === 'ai'
  const sheaiMode = modeProp === 'sheai'
  const scope = aiMode || sheaiMode ? 'listings' : scopeProp
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSearchTerm, setAiSearchTerm] = useState<string | null>(null)
  const [aiFilters, setAiFilters] = useState<ListingBrowseFilters>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
  const listingsBrowseEnabled = scope === 'listings' && effectiveListingQuery.length > 0
  const listingsFeed = useSearchListings({
    query: effectiveListingQuery,
    filters,
    enabled: listingsBrowseEnabled,
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
      setAiLoading(false)
      setAiError(null)
      return
    }

    let cancelled = false
    setAiLoading(true)
    setAiError(null)
    void runAiSearch(query)
      .then((next) => {
        if (cancelled) return
        setAiAnswer(next.answer)
        setAiSearchTerm(next.searchTerm)
        setAiFilters(next.filters)
        setAiLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAiError(err instanceof Error ? err.message : 'AI search failed')
        setAiSearchTerm(query)
        setAiFilters({})
        setAiLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [aiMode, query])

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
  }, [query, scope, tier, user?.id, userGeo.latitude, userGeo.longitude])

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
    if (sheaiMode) params.set('mode', 'sheai')
    const search = params.toString()
    replaceApp((search ? `/search?${search}` : '/search?scope=listings') as never)
  }

  function runHistoryTerm(term: string) {
    recordSearchTerm(term)
    navigateApp(appRoutes.search(term, scope) as never)
  }

  const gated = scope !== 'all' && !canAccessSearchScope(tier, scope)
  const sheaiEnabled = !gated && scope === 'listings' && query.length > 0
  const sheai = useSheaiRecommend(query, sheaiEnabled, 10)
  const visibleScopes = sheaiMode ? (['listings'] as SearchScope[]) : scopes

  const visibleSections = SECTION_META.filter(
    (section) => scope === 'all' || scope === section.scope,
  )

  function runSheaiTerm(term: string) {
    recordSearchTerm(term)
    navigateApp(buildSheaiSearchHref(term) as never)
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" gap="$4">
        {sheaiMode && !query ? null : (
        <YStack gap="$3" width="100%">
          <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            {sheaiMode && query
              ? `SHEai results for “${query}”`
              : aiMode && query
                ? `AI results for “${query}”`
                : query
                  ? `Results for “${query}”`
                  : 'Search'}
          </Text>

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
                  Ask AI
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
              {!aiLoading && aiAnswer ? (
                <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                  {aiAnswer}
                </Text>
              ) : null}
              {!aiLoading && aiSearchTerm && aiSearchTerm !== query ? (
                <Text fontSize={12} color={ui.textMuted}>
                  Searching listings for “{aiSearchTerm}”
                </Text>
              ) : null}
            </YStack>
          ) : null}

          <HorizontalScrollRow gap="$2">
            {visibleScopes.map((item) => {
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
        )}

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

        {!gated && !query && sheaiMode ? (
          <YStack
            width="100%"
            alignItems="center"
            justifyContent="center"
            paddingVertical="$8"
            minHeight={420}
          >
            <SheaiPrompt onPickChip={runSheaiTerm} onSubmit={runSheaiTerm} />
          </YStack>
        ) : null}

        {!gated && !query && !sheaiMode ? (
          <YStack gap="$4" width="100%">
            <Text fontSize={14} color={ui.textSecondary}>
              Search listings, shops, people, companies, groups, jobs, posts, programs, and
              meetings. Use the camera, mic, or SHEai in the search bar.
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

        {!gated && query && scope === 'listings' ? (
          <ListingFiltersShell filters={filters} onApply={updateFilters}>
            <YStack gap="$4" width="100%">
            {sheaiMode ? <SheaiAskAgain onSubmit={runSheaiTerm} /> : null}
            <SheaiResultsSection
              query={query}
              items={sheai.items}
              loading={sheai.loading}
              error={sheai.error}
            />
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
              emptyMessage={
                aiLoading
                  ? 'Finding matches…'
                  : `No listing results for “${effectiveListingQuery || query}”.`
              }
            />
            </YStack>
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
