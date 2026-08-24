import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useParams, useRouter } from 'one'

import { LoadMoreEnd } from '~/commerce/components/LoadMoreSentinel'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { useHashtagFollow } from '~/community/hooks/useHashtagFollow'
import { BRAND_BLUE } from '~/community/lib/constants'
import { trackCommunityHashtagShoppableFilter } from '~/community/lib/community-commerce-analytics'
import { fetchHashtagFeedPage, type CommunityPost } from '~/community/lib/community'
import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { ShareButton } from '~/components/share'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { communityRoutes } from '~/lib/routes'
import { getHashtagShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { useQueryParam } from '~/hooks/useQueryParams'
import { HorizontalScrollRow } from '~/components/layout'

export function HashtagFeedScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const { tag } = useParams<{ tag: string }>()
  const normalizedTag = decodeURIComponent(tag ?? '').replace(/^#/, '')
  const shoppableParam = useQueryParam('shoppable')
  const [shoppableOnly, setShoppableOnly] = useState(false)
  const follow = useHashtagFollow(normalizedTag)

  useEffect(() => {
    if (shoppableParam === '1') {
      setShoppableOnly(true)
    }
  }, [shoppableParam])

  usePageSeo(
    useMemo(() => {
      if (!normalizedTag) return null
      return {
        title: `#${normalizedTag}`,
        description: `Posts tagged #${normalizedTag} from the SHEconomy community.`,
      }
    }, [normalizedTag]),
  )

  const fetchPage = useCallback(
    (page: number) => fetchHashtagFeedPage(normalizedTag, page, undefined, { shoppableOnly }),
    [normalizedTag, shoppableOnly],
  )

  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } =
    usePaginatedFeed<CommunityPost>({
      fetchPage,
      enabled: !!normalizedTag,
    })

  async function handleFollowToggle() {
    if (!follow.isAuthenticated) {
      router.push(buildSignInUrl(communityRoutes.hashtag(normalizedTag)) as never)
      return
    }
    const wasFollowing = follow.isFollowing
    const result = await follow.toggleFollow()
    if (result.error) {
      toast.show('Could not update follow', { tone: 'danger', message: result.error })
      return
    }
    toast.show(wasFollowing ? 'Unfollowed hashtag' : 'Following hashtag', {
      tone: 'success',
    })
  }

  const listHeader = useMemo(
    () => (
      <YStack
        width="100%"
        backgroundColor={ui.surface}
        borderRadius={10}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        padding="$4"
        gap="$3"
        marginBottom="$3"
        style={{ boxShadow: ui.shadowSoft }}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
          <YStack gap="$2" flex={1}>
            <Text fontSize={22} fontWeight="700" color={ui.text}>
              #{normalizedTag}
            </Text>
            <Text fontSize={14} color={ui.textSecondary}>
              Follow this hashtag to get notified when people post about it.
            </Text>
          </YStack>
          <XStack gap="$2" alignItems="center">
            <Button
              size="$3"
              tone={follow.isFollowing ? 'outline' : 'primary'}
              borderRadius={999}
              disabled={follow.isLoading || follow.isToggling}
              backgroundColor={follow.isFollowing ? undefined : BRAND_BLUE}
              onPress={() => void handleFollowToggle()}
            >
              {follow.isToggling ? '…' : follow.isFollowing ? 'Following' : 'Follow'}
            </Button>
            <ShareButton
              variant="icon"
              label="Share hashtag"
              sheetTitle="Share hashtag"
              copyLabel="Copy hashtag link"
              copyToastMessage="Hashtag link copied to clipboard."
              payload={{
                url: shoppableOnly
                  ? `${getHashtagShareUrl(normalizedTag)}?shoppable=1`
                  : getHashtagShareUrl(normalizedTag),
                title: `#${normalizedTag}`,
              }}
            />
          </XStack>
        </XStack>
        <HorizontalScrollRow gap={8}>
          {[
            { id: false, label: 'All posts' },
            { id: true, label: 'Shoppable' },
          ].map((filter) => {
            const active = shoppableOnly === filter.id
            return (
              <XStack
                key={filter.label}
                paddingHorizontal={14}
                paddingVertical={8}
                borderRadius={999}
                borderWidth={1}
                borderColor={active ? BRAND_BLUE : ui.borderSubtle}
                backgroundColor={active ? `${BRAND_BLUE}14` : ui.surface}
                cursor="pointer"
                onPress={() => {
                  setShoppableOnly(filter.id)
                  if (filter.id) {
                    trackCommunityHashtagShoppableFilter({ hashtag: normalizedTag, enabled: true })
                  }
                }}
              >
                <Text fontSize={13} fontWeight="700" color={active ? BRAND_BLUE : ui.textMuted}>
                  {filter.label}
                </Text>
              </XStack>
            )
          })}
        </HorizontalScrollRow>
      </YStack>
    ),
    [
      follow.isFollowing,
      follow.isLoading,
      follow.isToggling,
      normalizedTag,
      shoppableOnly,
      ui.borderSubtle,
      ui.shadowSoft,
      ui.surface,
      ui.text,
      ui.textMuted,
      ui.textSecondary,
    ],
  )

  const renderItem = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <YStack width="100%" paddingBottom={12}>
        <FeedPostCard post={item} />
      </YStack>
    ),
    [],
  )

  return (
    <CommunityShell scroll={false}>
      <YStack flex={1} minHeight={0} width="100%">
        {isLoading ? (
          <YStack alignItems="center" paddingVertical="$8">
            {listHeader}
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack gap="$3">
            {listHeader}
            <YStack padding="$4" borderRadius={10} backgroundColor={ui.surface}>
              <Text color={ui.textMuted}>{error}</Text>
            </YStack>
          </YStack>
        ) : items.length === 0 ? (
          <YStack gap="$3">
            {listHeader}
            <YStack
              padding="$6"
              borderRadius={10}
              backgroundColor={ui.surface}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              alignItems="center"
            >
              <Text color={ui.textMuted}>
                {shoppableOnly
                  ? `No shoppable posts with #${normalizedTag} yet.`
                  : `No posts with #${normalizedTag} yet.`}
              </Text>
            </YStack>
          </YStack>
        ) : (
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            ListFooterComponent={!hasMore ? <LoadMoreEnd /> : null}
            onEndReached={() => {
              if (hasMore && !isLoadingMore) loadMore()
            }}
            onEndReachedThreshold={0.75}
            drawDistance={500}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingBottom: Platform.OS === 'web' ? 24 : APP_LAYOUT.mobileTabBarHeight + 64,
            }}
          />
        )}
      </YStack>
    </CommunityShell>
  )
}
