import { Link } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import {
  CommunityFilterPill,
  CommunityFilterSheet,
  type FilterOption,
} from '~/community/components/CommunityFilters'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import {
  fetchNotificationCategories,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '~/community/lib/notifications'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function NotificationsScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const { user } = useSupabase()
  const [items, setItems] = useState<AppNotification[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [categoryFacets, setCategoryFacets] = useState<string[]>([])
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!user) {
        setItems([])
        setIsLoading(false)
        return
      }
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      const result = await fetchNotifications(user.id, pageToLoad, { category, unreadOnly })
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [category, unreadOnly, user],
  )

  useEffect(() => {
    if (user) fetchNotificationCategories(user.id).then(setCategoryFacets)
  }, [user])

  useEffect(() => {
    load(0, false)
  }, [load])

  const categoryOptions = useMemo<FilterOption[]>(
    () => categoryFacets.map((value) => ({ label: titleCase(value), value })),
    [categoryFacets],
  )

  async function handleOpen(notification: AppNotification) {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      )
    }
  }

  async function handleMarkAll() {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setItems((current) => current.map((item) => ({ ...item, read: true })))
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <XStack gap={8} alignItems="center" paddingVertical={2}>
                  <CommunityFilterPill
                    label="Category"
                    summary={category ? titleCase(category) : undefined}
                    active={!!category}
                    onPress={() => setCategorySheetOpen(true)}
                  />
                  <CommunityFilterPill
                    label="Unread only"
                    summary="Unread only"
                    active={unreadOnly}
                    onPress={() => setUnreadOnly((v) => !v)}
                  />
                  {category || unreadOnly ? (
                    <Text
                      fontSize={13}
                      fontWeight="600"
                      color={communityUi.brand}
                      cursor="pointer"
                      paddingHorizontal={6}
                      onPress={() => {
                        setCategory('')
                        setUnreadOnly(false)
                      }}
                    >
                      Clear all
                    </Text>
                  ) : null}
                </XStack>
              </ScrollView>
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
            ) : (
              <YStack gap={0}>
                {items.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={handleOpen}
                  />
                ))}
                {hasMore ? (
                  <YStack alignItems="center" paddingVertical={12}>
                    {isLoadingMore ? (
                      <Spinner size="small" color={communityUi.brand} />
                    ) : (
                      <Text
                        color={communityUi.brand}
                        fontWeight="600"
                        cursor="pointer"
                        onPress={() => load(page + 1, true)}
                      >
                        Load more
                      </Text>
                    )}
                  </YStack>
                ) : null}
              </YStack>
            )}
          </CommunityCard>

          <CommunityFilterSheet
            open={categorySheetOpen}
            onOpenChange={setCategorySheetOpen}
            title="Category"
            options={categoryOptions}
            value={category ? [category] : []}
            onApply={(next) => setCategory(next[0] ?? '')}
            searchable
            searchPlaceholder="Search categories"
          />
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
            <YStack width={8} height={8} borderRadius={999} backgroundColor={communityUi.brand} flexShrink={0} />
          ) : null}
          <Text fontSize={14} fontWeight={notification.read ? '500' : '700'} color={communityUi.text} flex={1}>
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

  if (notification.action_url) {
    return <Link href={notification.action_url as never}>{row}</Link>
  }

  return row
}