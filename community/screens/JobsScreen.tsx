import { Link } from 'one'
import { useCallback, useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { searchJobs, type JobListing } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

export function JobsScreen() {
  const communityUi = useCommunityUi()
  const [search, setSearch] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [items, setItems] = useState<JobListing[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      const result = await searchJobs({ search, isRemote: remoteOnly, page: pageToLoad })
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [remoteOnly, search],
  )

  useEffect(() => {
    load(0, false)
  }, [load])

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={12}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Jobs
        </Text>
        <XStack gap={8} alignItems="center" padding={10} borderRadius={8} borderWidth={1} borderColor={communityUi.border}>
          <Icons.Search size={18} color={communityUi.textMuted} />
          <Input flex={1} value={search} onChangeText={setSearch} placeholder="Search jobs, companies, skills" borderWidth={0} backgroundColor="transparent" />
        </XStack>
        <Button
          size="$3"
          alignSelf="flex-start"
          backgroundColor={remoteOnly ? communityUi.brand : communityUi.divider}
          onPress={() => setRemoteOnly((v) => !v)}
        >
          Remote only
        </Button>
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : (
        <CommunityCard padding={12} gap={0}>
          {items.length === 0 ? (
            <Text color={communityUi.textMuted} padding={12}>
              No jobs found.
            </Text>
          ) : (
            items.map((job) => (
              <Link key={job.id} href={communityRoutes.job(job.id)}>
                <YStack paddingVertical={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight} gap={4}>
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
                  </Text>
                </YStack>
              </Link>
            ))
          )}
          {hasMore ? (
            <YStack alignItems="center" paddingVertical={12}>
              {isLoadingMore ? (
                <Spinner size="small" color={communityUi.brand} />
              ) : (
                <Text color={communityUi.brand} fontWeight="600" cursor="pointer" onPress={() => load(page + 1, true)}>
                  Load more
                </Text>
              )}
            </YStack>
          ) : null}
        </CommunityCard>
      )}
    </CommunityShell>
  )
}