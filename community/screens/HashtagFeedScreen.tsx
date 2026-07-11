import { useCallback } from 'react'
import { useParams } from 'one'

import { LoadMoreEnd, LoadMoreSentinel } from '~/commerce/components/LoadMoreSentinel'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchHashtagFeedPage, type CommunityPost } from '~/community/lib/community'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { ShareButton } from '~/components/share'
import { usePaginatedFeed } from '~/commerce/hooks/usePaginatedFeed'
import { useAppUi } from '~/lib/theme/useAppUi'
import { getHashtagShareUrl } from '~/lib/share'

export function HashtagFeedScreen() {
  const ui = useAppUi()
  const { tag } = useParams<{ tag: string }>()
  const normalizedTag = decodeURIComponent(tag ?? '').replace(/^#/, '')

  const fetchPage = useCallback(
    (page: number) => fetchHashtagFeedPage(normalizedTag, page),
    [normalizedTag],
  )

  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } =
    usePaginatedFeed<CommunityPost>({
      fetchPage,
      enabled: !!normalizedTag,
    })

  return (
    <CommunityShell>
      <YStack
        width="100%"
        backgroundColor={ui.surface}
        borderRadius={10}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        padding="$4"
        gap="$2"
        style={{ boxShadow: ui.shadowSoft }}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
          <YStack gap="$2" flex={1}>
            <Text fontSize={22} fontWeight="700" color={ui.text}>
              #{normalizedTag}
            </Text>
            <Text fontSize={14} color={ui.textSecondary}>
              Posts tagged with #{normalizedTag}
            </Text>
          </YStack>
          <ShareButton
            variant="icon"
            label="Share hashtag"
            sheetTitle="Share hashtag"
            copyLabel="Copy hashtag link"
            copyToastMessage="Hashtag link copied to clipboard."
            payload={{
              url: getHashtagShareUrl(normalizedTag),
              title: `#${normalizedTag}`,
            }}
          />
        </XStack>
      </YStack>

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <YStack padding="$4" borderRadius={10} backgroundColor={ui.surface}>
          <Text color={ui.textMuted}>{error}</Text>
        </YStack>
      ) : items.length === 0 ? (
        <YStack
          padding="$6"
          borderRadius={10}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          alignItems="center"
        >
          <Text color={ui.textMuted}>No posts with #{normalizedTag} yet.</Text>
        </YStack>
      ) : (
        <>
          {items.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
          {!hasMore ? <LoadMoreEnd /> : null}
        </>
      )}
    </CommunityShell>
  )
}