import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  CommunityFilterPill,
  CommunityFilterSheet,
  type FilterOption,
} from '~/community/components/CommunityFilters'
import {
  fetchCompanies,
  fetchCompanyFacets,
  fetchMyCompanies,
  type CompanyPage,
} from '~/community/lib/companies'
import { useCommunityUi } from '~/community/lib/community-theme'
import { LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { ScreenSearchField } from '~/components/search'
import { Avatar, Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useScreenSearch } from '~/hooks/useScreenSearch'
import { useSupabase } from '~/providers/SupabaseProvider'

type ActiveSheet = 'industry' | 'location' | 'size' | null

function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ label: value, value }))
}

export function CompaniesScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { user } = useSupabase()
  const { input: search, setInput: setSearch, debounced: searchQuery } = useScreenSearch()
  const [mine, setMine] = useState<CompanyPage[]>([])
  const [discover, setDiscover] = useState<CompanyPage[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [size, setSize] = useState('')
  const [facets, setFacets] = useState<{ industries: string[]; locations: string[]; sizes: string[] }>({
    industries: [],
    locations: [],
    sizes: [],
  })
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)

  useEffect(() => {
    fetchCompanyFacets().then(setFacets)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const [myPages, pages] = await Promise.all([
        user ? fetchMyCompanies(user.id) : Promise.resolve([]),
        fetchCompanies(0, searchQuery, { industry, location, size }),
      ])
      if (cancelled) return
      setMine(myPages)
      setDiscover(pages.items)
      setPage(0)
      setHasMore(pages.hasMore)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [industry, location, searchQuery, size, user])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    const next = page + 1
    const result = await fetchCompanies(next, searchQuery, { industry, location, size })
    setDiscover((current) => [...current, ...result.items])
    setPage(next)
    setHasMore(result.hasMore)
    setIsLoadingMore(false)
  }, [hasMore, industry, isLoadingMore, location, page, searchQuery, size])

  const industryOptions = useMemo(() => toOptions(facets.industries), [facets.industries])
  const locationOptions = useMemo(() => toOptions(facets.locations), [facets.locations])
  const sizeOptions = useMemo(() => toOptions(facets.sizes), [facets.sizes])

  const filteredDiscover = discover

  const activeCount = (industry ? 1 : 0) + (location ? 1 : 0) + (size ? 1 : 0)

  function clearAll() {
    setIndustry('')
    setLocation('')
    setSize('')
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Pages"
          subtitle="Follow pages and see their updates."
          actions={
            user ? (
              <Button
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                onPress={() => router.push(communityRoutes.companyCreate)}
              >
                Create page
              </Button>
            ) : undefined
          }
        />
        <ScreenSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search pages"
          unifiedScope="companies"
          variant="plain"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} alignItems="center" paddingVertical={2}>
            <CommunityFilterPill
              label="Industry"
              summary={industry || undefined}
              active={!!industry}
              onPress={() => setActiveSheet('industry')}
            />
            <CommunityFilterPill
              label="Location"
              summary={location || undefined}
              active={!!location}
              onPress={() => setActiveSheet('location')}
            />
            <CommunityFilterPill
              label="Company size"
              summary={size || undefined}
              active={!!size}
              onPress={() => setActiveSheet('size')}
            />
            {activeCount > 0 ? (
              <Text
                fontSize={13}
                fontWeight="600"
                color={communityUi.brand}
                cursor="pointer"
                paddingHorizontal={6}
                onPress={clearAll}
              >
                Clear all
              </Text>
            ) : null}
          </XStack>
        </ScrollView>
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <>
          {mine.length > 0 ? <CompanySection title="Your pages" items={mine} /> : null}
          <CompanySection title="Discover" items={filteredDiscover} />
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </>
      )}

      <CommunityFilterSheet
        open={activeSheet === 'industry'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Industry"
        options={industryOptions}
        value={industry ? [industry] : []}
        onApply={(next) => setIndustry(next[0] ?? '')}
        searchable
        searchPlaceholder="Search industries"
      />
      <CommunityFilterSheet
        open={activeSheet === 'location'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Location"
        options={locationOptions}
        value={location ? [location] : []}
        onApply={(next) => setLocation(next[0] ?? '')}
        searchable
        searchPlaceholder="Search locations"
      />
      <CommunityFilterSheet
        open={activeSheet === 'size'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Company size"
        options={sizeOptions}
        value={size ? [size] : []}
        onApply={(next) => setSize(next[0] ?? '')}
      />
    </CommunityShell>
  )
}

function CompanySection({ title, items }: { title: string; items: CompanyPage[] }) {
  const communityUi = useCommunityUi()
  if (!items.length) return null
  return (
    <CommunityCard padding={12} gap={0}>
      <Text fontSize={16} fontWeight="700" color={communityUi.text} paddingBottom={12}>
        {title}
      </Text>
      {items.map((company) => (
        <AppLink key={company.id} href={communityRoutes.company(company.id)}>
          <XStack gap={12} paddingVertical={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} alignItems="center">
            <Avatar name={company.name} src={company.logo_url ?? undefined} size="$4" />
            <YStack flex={1} gap={2}>
              <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                {company.name}
              </Text>
              <Text fontSize={13} color={communityUi.textMuted}>
                {company.industry}
                {company.location ? ` · ${company.location}` : ''}
              </Text>
            </YStack>
          </XStack>
        </AppLink>
      ))}
    </CommunityCard>
  )
}
