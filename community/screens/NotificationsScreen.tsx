import { Link, useRouter } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import {
  CommunityFilterPill,
} from '~/community/components/CommunityFilters'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { PushPermissionBanner } from '~/components/notifications/PushPermissionBanner'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_PRODUCT_FILTERS,
  type AppNotification,
  type NotificationProductFilter,
} from '~/community/lib/notifications'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Input, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { pathFromNotificationUrl } from '~/lib/notifications/push-config'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function NotificationsScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useSupabase()
  const [items, setItems] = useState<AppNotification[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [product, setProduct] = useState<NotificationProductFilter>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => {
      const haystack = [item.title, item.message, item.type, item.category, item.platform]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query])

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
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [product, unreadOnly, user],
  )

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

  async function handleOpen(notification: AppNotification) {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      )
    }
    const path = pathFromNotificationUrl(notification.action_url)
    if (path) router.push(path as never)
  }

  async function handleMarkAll() {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setItems((current) => current.map((item) => ({ ...item, read: true })))
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$4" width="100%">
          <PushPermissionBanner />
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
                <XStack
                  alignItems="center"
                  gap={8}
                  paddingHorizontal={12}
                  minHeight={42}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={communityUi.borderLight}
                  backgroundColor={ui.surface}
                >
                  <Icons.Search size={16} color={ui.textMuted} />
                  <Input
                    flex={1}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search notifications"
                    borderWidth={0}
                    backgroundColor="transparent"
                    height={40}
                    paddingHorizontal={0}
                  />
                  {query ? (
                    <XStack cursor="pointer" onPress={() => setQuery('')} padding={4}>
                      <Icons.X size={14} color={ui.textMuted} />
                    </XStack>
                  ) : null}
                </XStack>
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
            ) : isLoading ? (
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
                {hasMore && !query.trim() ? (
                  <YStack alignItems="center" paddingVertical={12}>
                    {isLoadingMore ? (
                      <Spinner size="small" color={communityUi.brand} />
                    ) : (
                      <Text
                        color={communityUi.brand}
                        fontWeight="600"
                        cursor="pointer"
                        onPress={() => void load(page + 1, true)}
                      >
                        Load more
                      </Text>
                    )}
                  </YStack>
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
  const path = pathFromNotificationUrl(notification.action_url)
  const row = (
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
      onPress={() => onOpen(notification)}
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

  if (path) {
    return <Link href={path as never}>{row}</Link>
  }

  return row
}
