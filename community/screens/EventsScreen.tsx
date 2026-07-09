import { Link } from 'one'
import { useCallback, useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

export function EventsScreen() {
  const communityUi = useCommunityUi()
  const [items, setItems] = useState<CommunityEvent[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    if (append) setIsLoadingMore(true)
    else setIsLoading(true)
    const result = await fetchUpcomingEvents(pageToLoad)
    setItems((current) => (append ? [...current, ...result.items] : result.items))
    setHasMore(result.hasMore)
    setPage(pageToLoad)
    setIsLoading(false)
    setIsLoadingMore(false)
  }, [])

  useEffect(() => {
    load(0, false)
  }, [load])

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={12}>
        <XStack justifyContent="space-between" alignItems="flex-start" gap={12} flexWrap="wrap">
          <YStack gap={4} flex={1}>
            <Text fontSize={24} fontWeight="700" color={communityUi.text}>
              Events
            </Text>
            <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
              Discover meetups, workshops, and online sessions from the {BRAND_NAME} network.
            </Text>
          </YStack>
          <Link href={communityRoutes.eventCreate}>
            <Button backgroundColor={communityUi.brand} color="white" borderRadius={999} icon={<Icons.Plus size={16} color="white" />}>
              Create event
            </Button>
          </Link>
        </XStack>
      </CommunityCard>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      ) : items.length === 0 ? (
        <CommunityCard padding={24} gap={12} alignItems="center">
          <Icons.Calendar size={40} color={communityUi.brand} />
          <Text fontWeight="600" color={communityUi.text}>
            No upcoming events
          </Text>
          <Text color={communityUi.textMuted} textAlign="center">
            Host a session for your network or community group.
          </Text>
          <Link href={communityRoutes.eventCreate}>
            <Text color={communityUi.brand} fontWeight="600">
              Create the first event
            </Text>
          </Link>
        </CommunityCard>
      ) : (
        <YStack gap={12}>
          {items.map((event) => (
            <Link key={event.id} href={communityRoutes.event(event.id)}>
              <CommunityCard padding={0} overflow="hidden">
                {event.image_url ? (
                  <Image src={event.image_url} width="100%" height={160} />
                ) : (
                  <YStack height={120} backgroundColor={communityUi.brand} alignItems="center" justifyContent="center">
                    <Icons.Calendar size={36} color="white" />
                  </YStack>
                )}
                <YStack padding={16} gap={8}>
                  <Text fontSize={18} fontWeight="700" color={communityUi.text}>
                    {event.title}
                  </Text>
                  <Text fontSize={13} color={communityUi.textMuted}>
                    {formatWhen(event.start_time)}
                    {event.is_online ? ' · Online' : event.location ? ` · ${event.location}` : ''}
                  </Text>
                  <XStack gap={8} flexWrap="wrap">
                    <Badge label={event.is_free === false ? `${event.currency ?? 'INR'} ${event.price}` : 'Free'} />
                    {event.event_type ? <Badge label={event.event_type} /> : null}
                  </XStack>
                </YStack>
              </CommunityCard>
            </Link>
          ))}
          {hasMore ? (
            <YStack alignItems="center" paddingVertical={12}>
              {isLoadingMore ? (
                <Spinner size="small" color={communityUi.brand} />
              ) : (
                <Text color={communityUi.brand} fontWeight="600" cursor="pointer" onPress={() => load(page + 1, true)}>
                  Load more events
                </Text>
              )}
            </YStack>
          ) : null}
        </YStack>
      )}
    </CommunityShell>
  )
}

function Badge({ label }: { label: string }) {
  const communityUi = useCommunityUi()
  return (
    <XStack paddingHorizontal={10} paddingVertical={4} borderRadius={999} backgroundColor={communityUi.divider}>
      <Text fontSize={12} fontWeight="600" color={communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}