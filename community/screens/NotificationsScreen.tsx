import { useRouter } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import {
  CommunityFilterPill,
} from '~/community/components/CommunityFilters'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_PRODUCT_FILTERS,
  resolveNotificationPath,
  type AppNotification,
  type NotificationProductFilter,
} from '~/community/lib/notifications'
import { LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { ScreenSearchField } from '~/components/search'
import { CACHE_KEYS } from '~/lib/bootstrap/app-prefetch'
import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { filterBySearchQuery } from '~/lib/search'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type NotificationsCache = {
  items: AppNotification[]
  hasMore: boolean
  error: string | null
}

export function NotificationsScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useSupabase()
  const cacheKey = user?.id ? CACHE_KEYS.notifications(user.id) : null
  const initial = cacheKey ? peekAppCache<NotificationsCache>(cacheKey) : null
  const [items, setItems] = useState<AppNotification[]>(initial?.items ?? [])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false)
  const [isLoading, setIsLoading] = useState(!!user && !initial)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [product, setProduct] = useState<NotificationProductFilter>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')

  const visibleItems = useMemo(
    () =>
      filterBySearchQuery(items, query, (item) => [
        item.title,
        item.message,
        item.type,
        item.category,
        item.platform,
      ]),
    [items, query],
  )

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!user) {
        setItems([])
        setIsLoading(false)
        return
      }
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      const result = await fetchNotifications(user.id, pageToLoad, { product, unreadOnly })
      if (append) {
        // Functional update keeps `items` out of this callback's deps —
        // otherwise every fetch recreates `load` and the mount effect
        // refetches page 0 in a loop, resetting the list while scrolling.
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id))
          return [...current, ...result.items.filter((item) => !seen.has(item.id))]
        })
      } else {
        setItems(result.items)
        if (cacheKey && !product && !unreadOnly) {
          await writeAppCache(cacheKey, {
            items: result.items,
            hasMore: result.hasMore,
            error: result.error ?? null,
          })
        }
      }
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [cacheKey, product, unreadOnly, user],
  )

  useEffect(() => {
    if (!user?.id || !cacheKey) return
    let cancelled = false
    void (async () => {
      const cached =
        peekAppCache<NotificationsCache>(cacheKey) ??
        (await readAppCache<NotificationsCache>(cacheKey))
      if (cancelled || !cached || product || unreadOnly) return
      setItems(cached.items)
      setHasMore(cached.hasMore)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [cacheKey, product, unreadOnly, user?.id])

  useEffect(() => {
    void load(0, false)
  }, [load])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`notifications-inbox:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          void load(0, false)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, user?.id])

  const persistReadState = useCallback(
    (mapper: (item: AppNotification) => AppNotification) => {
      setItems((current) => {
        const next = current.map(mapper)
        // Keep the offline cache in sync so a refresh doesn't resurrect
        // already-read rows from stale cached data.
        if (cacheKey) {
          const cached = peekAppCache<NotificationsCache>(cacheKey)
          void writeAppCache(cacheKey, {
            items: (cached?.items ?? next).map(mapper),
            hasMore: cached?.hasMore ?? hasMore,
            error: cached?.error ?? null,
          })
        }
        return next
      })
    },
    [cacheKey, hasMore],
  )

  async function handleOpen(notification: AppNotification) {
    if (!notification.read) {
      persistReadState((item) => (item.id === notification.id ? { ...item, read: true } : item))
      await markNotificationRead(notification.id, user?.id)
    }
    const path = resolveNotificationPath(notification)
    if (path && path !== '/notifications') {
      router.push(path as never)
    }
  }

  async function handleMarkAll() {
    if (!user) return
    persistReadState((item) => ({ ...item, read: true }))
    await markAllNotificationsRead(user.id)
  }

  return (
    <FullWidthLayout scroll onRefresh={() => void load(0, false)}>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$4" width="100%">
          <CommunityCard padding={18} gap={14} width="100%">
            <CommunityPageHeader
              title="Notifications"
              actions={
                user ? (
                  <Button size="$3" tone="outline" borderRadius={999} onPress={handleMarkAll}>
                    Mark all read
                  </Button>
                ) : undefined
              }
            />
            {user ? (
              <YStack gap={10}>
                <ScreenSearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search notifications"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack gap={8} alignItems="center" paddingVertical={2}>
                    {NOTIFICATION_PRODUCT_FILTERS.map((filter) => (
                      <CommunityFilterPill
                        key={filter.key || 'all'}
                        label={filter.label}
                        summary={filter.label}
                        active={product === filter.key}
                        onPress={() => setProduct(filter.key)}
                      />
                    ))}
                    <CommunityFilterPill
                      label="Unread only"
                      summary="Unread only"
                      active={unreadOnly}
                      onPress={() => setUnreadOnly((v) => !v)}
                    />
                    {product || unreadOnly || query ? (
                      <Text
                        fontSize={13}
                        fontWeight="600"
                        color={communityUi.brand}
                        cursor="pointer"
                        paddingHorizontal={6}
                        onPress={() => {
                          setProduct('')
                          setUnreadOnly(false)
                          setQuery('')
                        }}
                      >
                        Clear
                      </Text>
                    ) : null}
                  </XStack>
                </ScrollView>
              </YStack>
            ) : null}
            {!user ? (
              <Text color={ui.textMuted}>Sign in to see your notifications.</Text>
            ) : isLoading && items.length === 0 ? (
              <YStack alignItems="center" paddingVertical="$6">
                <Spinner size="large" color={communityUi.brand} />
              </YStack>
            ) : items.length === 0 ? (
              <YStack alignItems="center" paddingVertical="$6" gap="$2">
                <Text color={ui.textMuted} fontWeight="500" textAlign="center">
                  You are all caught up.
                </Text>
              </YStack>
            ) : visibleItems.length === 0 ? (
              <YStack alignItems="center" paddingVertical="$6" gap="$2">
                <Text color={ui.textMuted} fontWeight="500" textAlign="center">
                  No notifications match your search.
                </Text>
              </YStack>
            ) : (
              <YStack gap={0}>
                {visibleItems.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={handleOpen}
                  />
                ))}
                {!query.trim() ? (
                  <LoadMoreSentinel
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={() => void load(page + 1, true)}
                  />
                ) : null}
              </YStack>
            )}
          </CommunityCard>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification
  onOpen: (n: AppNotification) => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      gap={12}
      paddingVertical={14}
      borderBottomWidth={1}
      borderBottomColor={communityUi.borderLight}
      backgroundColor={notification.read ? 'transparent' : communityUi.accentMuted}
      alignItems="flex-start"
      cursor="pointer"
      borderRadius={10}
      marginBottom={4}
      paddingHorizontal={4}
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      onPress={() => void onOpen(notification)}
    >
      <Avatar name={notification.title} src={notification.image_url ?? undefined} size="$3" />
      <YStack flex={1} gap={4}>
        <XStack alignItems="center" gap={8}>
          {!notification.read ? (
            <YStack
              width={8}
              height={8}
              borderRadius={999}
              backgroundColor={communityUi.brand}
              flexShrink={0}
            />
          ) : null}
          <Text
            fontSize={14}
            fontWeight={notification.read ? '500' : '700'}
            color={communityUi.text}
            flex={1}
          >
            {notification.title}
          </Text>
        </XStack>
        <Text fontSize={13} color={communityUi.textMuted} lineHeight={18}>
          {notification.message}
        </Text>
        {notification.created_at ? (
          <Text fontSize={11} color={communityUi.textSubtle}>
            {new Date(notification.created_at).toLocaleString('en-IN')}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}
