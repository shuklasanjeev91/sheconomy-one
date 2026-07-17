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
import { fetchEventTypeFacets, fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import { useCommunityUi } from '~/community/lib/community-theme'
import { LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { Button, Icons, Image, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { communityRoutes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

const FORMAT_OPTIONS: FilterOption[] = [
  { label: 'Any format', value: 'any' },
  { label: 'Online', value: 'online' },
  { label: 'In person', value: 'in-person' },
]

const PRICE_OPTIONS: FilterOption[] = [
  { label: 'Any price', value: 'any' },
  { label: 'Free', value: 'free' },
  { label: 'Paid', value: 'paid' },
]

const DATE_OPTIONS: FilterOption[] = [
  { label: 'Any time', value: 'any' },
  { label: 'This week', value: '7' },
  { label: 'This month', value: '30' },
]

type ActiveSheet = 'type' | 'format' | 'price' | 'date' | null

function toOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ label: value, value }))
}

function labelForValue(options: FilterOption[], value: string): string | undefined {
  return options.find((option) => option.value === value)?.label
}

export function EventsScreen() {
  const communityUi = useCommunityUi()
  const [items, setItems] = useState<CommunityEvent[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [eventType, setEventType] = useState('')
  const [format, setFormat] = useState('any')
  const [price, setPrice] = useState('any')
  const [datePosted, setDatePosted] = useState('any')
  const [typeFacets, setTypeFacets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)

  const load = useCallback(
    async (pageToLoad: number, append: boolean, silent = false) => {
      if (append) setIsLoadingMore(true)
      else if (!silent) setIsLoading(true)
      const result = await fetchUpcomingEvents(pageToLoad, {
        eventType,
        format,
        price,
        withinDays: datePosted === 'any' ? undefined : Number(datePosted),
      })
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [datePosted, eventType, format, price],
  )

  useEffect(() => {
    fetchEventTypeFacets().then(setTypeFacets)
  }, [])

  useEffect(() => {
    load(0, false)
  }, [load])

  // New events created elsewhere show up without a manual route reload.
  useAutoRefresh(INVALIDATION_TOPICS.communityEvents, () => {
    void load(0, false, true)
  })

  const typeOptions = useMemo(() => toOptions(typeFacets), [typeFacets])

  const visibleItems = items

  const activeCount =
    (eventType ? 1 : 0) + (format !== 'any' ? 1 : 0) + (price !== 'any' ? 1 : 0) + (datePosted !== 'any' ? 1 : 0)

  function clearAll() {
    setEventType('')
    setFormat('any')
    setPrice('any')
    setDatePosted('any')
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={18} gap={12}>
        <CommunityPageHeader
          title="Events"
          subtitle={`Discover meetups, workshops, and online sessions from the ${BRAND_NAME} network.`}
          actions={
            <AppLink href={communityRoutes.eventCreate}>
              <Button
                backgroundColor={communityUi.brand}
                color="white"
                borderRadius={999}
                icon={<Icons.Plus size={16} color="white" />}
              >
                Create event
              </Button>
            </AppLink>
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap={8} alignItems="center" paddingVertical={2}>
            <CommunityFilterPill
              label="Event type"
              summary={eventType || undefined}
              active={!!eventType}
              onPress={() => setActiveSheet('type')}
            />
            <CommunityFilterPill
              label="Format"
              summary={format !== 'any' ? labelForValue(FORMAT_OPTIONS, format) : undefined}
              active={format !== 'any'}
              onPress={() => setActiveSheet('format')}
            />
            <CommunityFilterPill
              label="Price"
              summary={price !== 'any' ? labelForValue(PRICE_OPTIONS, price) : undefined}
              active={price !== 'any'}
              onPress={() => setActiveSheet('price')}
            />
            <CommunityFilterPill
              label="Date"
              summary={datePosted !== 'any' ? labelForValue(DATE_OPTIONS, datePosted) : undefined}
              active={datePosted !== 'any'}
              onPress={() => setActiveSheet('date')}
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
      ) : visibleItems.length === 0 ? (
        <CommunityCard padding={24} gap={12} alignItems="center">
          <Icons.Calendar size={40} color={communityUi.brand} />
          <Text fontWeight="600" color={communityUi.text}>
            No upcoming events
          </Text>
          <Text color={communityUi.textMuted} textAlign="center">
            Host a session for your network or community group.
          </Text>
          <AppLink href={communityRoutes.eventCreate}>
            <Text color={communityUi.brand} fontWeight="600">
              Create the first event
            </Text>
          </AppLink>
        </CommunityCard>
      ) : (
        <YStack gap={12}>
          {visibleItems.map((event) => (
            <AppLink key={event.id} href={communityRoutes.event(event.id)}>
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
            </AppLink>
          ))}
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void load(page + 1, true)}
            label="Load more events"
          />
        </YStack>
      )}

      <CommunityFilterSheet
        open={activeSheet === 'type'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Event type"
        options={typeOptions}
        value={eventType ? [eventType] : []}
        onApply={(next) => setEventType(next[0] ?? '')}
        searchable
        searchPlaceholder="Search types"
      />
      <CommunityFilterSheet
        open={activeSheet === 'format'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Format"
        options={FORMAT_OPTIONS}
        value={[format]}
        onApply={(next) => setFormat(next[0] ?? 'any')}
      />
      <CommunityFilterSheet
        open={activeSheet === 'price'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Price"
        options={PRICE_OPTIONS}
        value={[price]}
        onApply={(next) => setPrice(next[0] ?? 'any')}
      />
      <CommunityFilterSheet
        open={activeSheet === 'date'}
        onOpenChange={(open) => !open && setActiveSheet(null)}
        title="Date"
        options={DATE_OPTIONS}
        value={[datePosted]}
        onApply={(next) => setDatePosted(next[0] ?? 'any')}
      />
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