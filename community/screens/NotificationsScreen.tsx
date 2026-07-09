import { Link } from 'one'
import { useCallback, useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { FullWidthLayout, PageRail, PageSection } from '~/components/layout'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '~/community/lib/notifications'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

export function NotificationsScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const { user } = useSupabase()
  const [items, setItems] = useState<AppNotification[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const load = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!user) {
        setItems([])
        setIsLoading(false)
        return
      }
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      const result = await fetchNotifications(user.id, pageToLoad)
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setHasMore(result.hasMore)
      setPage(pageToLoad)
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [user],
  )

  useEffect(() => {
    load(0, false)
  }, [load])

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
      <PageSection paddingVertical="$6">
        <PageRail>
          <CommunityCard padding={16} gap={12}>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={24} fontWeight="700" color={ui.text}>
                Notifications
              </Text>
              {user ? (
                <Button size="$3" tone="outline" onPress={handleMarkAll}>
                  Mark all read
                </Button>
              ) : null}
            </XStack>
            {!user ? (
              <Text color={ui.textMuted}>Sign in to see your notifications.</Text>
            ) : isLoading ? (
              <YStack alignItems="center" paddingVertical="$6">
                <Spinner size="large" color={communityUi.brand} />
              </YStack>
            ) : items.length === 0 ? (
              <Text color={ui.textMuted}>You are all caught up.</Text>
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
        </PageRail>
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
      paddingVertical={12}
      borderBottomWidth={1}
      borderBottomColor={communityUi.borderLight}
      backgroundColor={notification.read ? 'transparent' : 'rgba(10,102,194,0.06)'}
      alignItems="flex-start"
      cursor="pointer"
      onPress={() => onOpen(notification)}
    >
      <Avatar name={notification.title} src={notification.image_url ?? undefined} size="$3" />
      <YStack flex={1} gap={4}>
        <Text fontSize={14} fontWeight={notification.read ? '500' : '700'} color={communityUi.text}>
          {notification.title}
        </Text>
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