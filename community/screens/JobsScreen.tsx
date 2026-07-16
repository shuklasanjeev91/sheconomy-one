import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  CommunityFilterPill,
  CommunityFilterSheet,
  type FilterOption,
} from '~/community/components/CommunityFilters'
import { fetchSavedJobs, searchJobs, type JobListing } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import { LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { ScreenSearchField } from '~/components/search'
import { Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useScreenSearch } from '~/hooks/useScreenSearch'
import { useSupabase } from '~/providers/SupabaseProvider'

const JOB_TYPE_OPTIONS: FilterOption[] = [
  { label: 'Full-time', value: 'Full-time' },
  { label: 'Part-time', value: 'Part-time' },
  { label: 'Contract', value: 'Contract' },
  { label: 'Internship', value: 'Internship' },
  { label: 'Freelance', value: 'Freelance' },
]

const EXPERIENCE_OPTIONS: FilterOption[] = [
  { label: 'Entry level', value: 'Entry level' },
  { label: 'Associate', value: 'Associate' },
  { label: 'Mid-Senior', value: 'Mid-Senior' },
  { label: 'Director', value: 'Director' },
  { label: 'Executive', value: 'Executive' },
]

const REMOTE_OPTIONS: FilterOption[] = [
  { label: 'Any location type', value: 'any' },
  { label: 'Remote', value: 'remote' },
]

const DATE_OPTIONS: FilterOption[] = [
  { label: 'Any time', value: 'any' },
  { label: 'Past 24 hours', value: '1' },
  { label: 'Past week', value: '7' },
  { label: 'Past month', value: '30' },
]

const SORT_OPTIONS: FilterOption[] = [
  { label: 'Most recent', value: 'recent' },
  { label: 'Most relevant', value: 'relevant' },
]

type ActiveSheet =
  | 'jobType'
  | 'experience'
  | 'remote'
  | 'company'
  | 'industry'
  | 'date'
  | 'sort'
  | null

function labelForValue(options: FilterOption[], value: string): string | undefined {
  return options.find((option) => option.value === value)?.label
}

export function JobsScreen() {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const { input: search, setInput: setSearch, debounced: searchQuery } = useScreenSearch()
  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [experience, setExperience] = useState('')
  const [remote, setRemote] = useState('any')
  const [company, setCompany] = useState('')
  const [industry, setIndustry] = useState('')
  const [datePosted, setDatePosted] = useState('any')
  const [sort, setSort] = useState('recent')
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)
  const [showSavedOnly, setShowSavedOnly] = useState(false)

  const [items, setItems] = useState<JobListing[]>([])
  const [savedJobs, setSavedJobs] = useState<JobListing[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      const result = await searchJobs({
        search: searchQuery,
        jobType: jobTypes[0] ?? '',
        experience,
        isRemote: remote === 'remote',
        page: pageToLoad,
      })
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [experience, jobTypes, remote, searchQuery],
  )

  useEffect(() => {
    load(0, false)
  }, [load])

  useEffect(() => {
    if (!user?.id) {
      setSavedJobs([])
      return
    }
    let active = true
    void fetchSavedJobs(user.id).then((result) => {
      if (active) setSavedJobs(result.items)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const companyOptions = useMemo<FilterOption[]>(() => {
    const names = Array.from(new Set(items.map((job) => job.company_name).filter(Boolean)))
    names.sort((a, b) => a.localeCompare(b))
    return names.map((name) => ({ label: name, value: name }))
  }, [items])

  const industryOptions = useMemo<FilterOption[]>(() => {
    const values = Array.from(
      new Set(items.map((job) => job.industry).filter((v): v is string => !!v)),
    )
    values.sort((a, b) => a.localeCompare(b))
    return values.map((value) => ({ label: value, value }))
  }, [items])

  const visibleItems = useMemo(() => {
    let next = showSavedOnly ? [...savedJobs] : [...items]

    if (jobTypes.length > 1) {
      next = next.filter((job) => jobTypes.includes(job.job_type))
    }

    if (company) {
      next = next.filter((job) => job.company_name === company)
    }

    if (industry) {
      next = next.filter((job) => job.industry === industry)
    }

    if (datePosted !== 'any') {
      const days = Number(datePosted)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      next = next.filter((job) => {
        const ts = job.created_at ? new Date(job.created_at).getTime() : 0
        return ts >= cutoff
      })
    }

    if (showSavedOnly && search.trim()) {
      const needle = search.trim().toLowerCase()
      next = next.filter((job) =>
        [job.title, job.company_name, job.location, job.job_type]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    }

    if (sort === 'recent') {
      next.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else {
      next.sort((a, b) => (b.application_count ?? 0) - (a.application_count ?? 0))
    }

    return next
  }, [company, datePosted, industry, items, jobTypes, savedJobs, search, showSavedOnly, sort])

  const activeCount =
    jobTypes.length +
    (experience ? 1 : 0) +
    (remote !== 'any' ? 1 : 0) +
    (company ? 1 : 0) +
    (industry ? 1 : 0) +
    (datePosted !== 'any' ? 1 : 0)

  function clearAll() {
    setJobTypes([])
    setExperience('')
    setRemote('any')
    setCompany('')
    setIndustry('')
    setDatePosted('any')
    setSort('recent')
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Jobs"
          subtitle="Find roles from women-led companies and founders in the network."
          actions={
            <AppLink href={communityRoutes.jobCreate} asChild>
              <Button
                size="$3"
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                icon={<Icons.Plus size={16} color="white" />}
              >
                Post a job
              </Button>
            </AppLink>
          }
        />

        {user ? (
          <CommunityFilterPill
            label={savedJobs.length ? `Saved (${savedJobs.length})` : 'Saved'}
            summary="Saved jobs"
            active={showSavedOnly}
            onPress={() => setShowSavedOnly((value) => !value)}
          />
        ) : null}

        <ScreenSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search jobs, companies, skills"
          unifiedScope="jobs"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} alignItems="center" paddingVertical={2}>
            <CommunityFilterPill
              label="Job type"
              summary={
                jobTypes.length === 1
                  ? jobTypes[0]
                  : jobTypes.length > 1
                    ? `Job type · ${jobTypes.length}`
                    : undefined
              }
              active={jobTypes.length > 0}
              onPress={() => setActiveSheet('jobType')}
            />
            <CommunityFilterPill
              label="Experience"
              summary={experience || undefined}
              active={!!experience}
              onPress={() => setActiveSheet('experience')}
            />
            <CommunityFilterPill
              label="Company"
              summary={company || undefined}
              active={!!company}
              onPress={() => setActiveSheet('company')}
            />
            <CommunityFilterPill
              label="Industry"
              summary={industry || undefined}
              active={!!industry}
              onPress={() => setActiveSheet('industry')}
            />
            <CommunityFilterPill
              label="On-site/remote"
              summary={remote !== 'any' ? labelForValue(REMOTE_OPTIONS, remote) : undefined}
              active={remote !== 'any'}
              onPress={() => setActiveSheet('remote')}
            />
            <CommunityFilterPill
              label="Date posted"
              summary={datePosted !== 'any' ? labelForValue(DATE_OPTIONS, datePosted) : undefined}
              active={datePosted !== 'any'}
              onPress={() => setActiveSheet('date')}
            />
            <CommunityFilterPill
              label="Sort by"
              summary={labelForValue(SORT_OPTIONS, sort)}
              active={sort !== 'recent'}
              onPress={() => setActiveSheet('sort')}
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
        <CommunityCard padding={12} gap={0}>
          {visibleItems.length === 0 ? (
            <Text color={communityUi.textMuted} padding={12}>
              {showSavedOnly ? 'No saved jobs yet. Open a role and tap Save job.' : 'No jobs found.'}
            </Text>
          ) : (
            visibleItems.map((job) => (
              <AppLink key={job.id} href={communityRoutes.job(job.id)}>
                <YStack
                  paddingVertical={12}
                  borderBottomWidth={1}
                  borderBottomColor={communityUi.borderLight}
                  gap={4}
                >
                  <Text fontSize={16} fontWeight="600" color={communityUi.text}>
                    {job.title}
                  </Text>
                  <Text fontSize={14} color={communityUi.textMuted}>
                    {job.company_name}
                  </Text>
                  <Text fontSize={13} color={communityUi.textMuted}>
                    {job.location} · {job.job_type}
                    {job.is_remote ? ' · Remote' : ''}
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted}>
                    {job.application_count} applicants
                    {job.is_applied ? ' · Applied' : ''}
                    {job.is_saved || showSavedOnly ? ' · Saved' : ''}
                  </Text>
                </YStack>
              </AppLink>
            ))
          )}
          {!showSavedOnly ? (
            <LoadMoreSentinel
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={() => void load(page + 1, true)}
            />
          ) : null}
        </CommunityCard>
      )}

      <CommunityFilterSheet
        open={activeSheet === 'jobType'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Job type"
        options={JOB_TYPE_OPTIONS}
        value={jobTypes}
        onApply={setJobTypes}
        multi
      />
      <CommunityFilterSheet
        open={activeSheet === 'experience'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Experience level"
        options={EXPERIENCE_OPTIONS}
        value={experience ? [experience] : []}
        onApply={(next) => setExperience(next[0] ?? '')}
      />
      <CommunityFilterSheet
        open={activeSheet === 'company'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Company"
        options={companyOptions}
        value={company ? [company] : []}
        onApply={(next) => setCompany(next[0] ?? '')}
        searchable
        searchPlaceholder="Search companies"
      />
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
        open={activeSheet === 'remote'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="On-site / remote"
        options={REMOTE_OPTIONS}
        value={[remote]}
        onApply={(next) => setRemote(next[0] ?? 'any')}
      />
      <CommunityFilterSheet
        open={activeSheet === 'date'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Date posted"
        options={DATE_OPTIONS}
        value={[datePosted]}
        onApply={(next) => setDatePosted(next[0] ?? 'any')}
      />
      <CommunityFilterSheet
        open={activeSheet === 'sort'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Sort by"
        options={SORT_OPTIONS}
        value={[sort]}
        onApply={(next) => setSort(next[0] ?? 'recent')}
      />
    </CommunityShell>
  )
}
