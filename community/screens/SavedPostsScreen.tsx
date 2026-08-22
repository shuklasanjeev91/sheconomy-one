import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { postHasMedia } from '~/community/lib/post-media'
import {
  buildSavedPostSections,
  fetchSavedCommunityPosts,
  postHasShoppableProducts,
  unsaveCommunityPost,
  type SavedCommunityPostEntry,
} from '~/community/lib/saved-posts'
import {
  buildSavedShoppablePriceDropRows,
  countSavedShoppablePriceDrops,
} from '~/community/lib/saved-shoppable-nudges'
import { HorizontalScrollRow } from '~/components/layout'
import { ScreenSearchField } from '~/components/search'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { filterBySearchQuery } from '~/lib/search'
import { INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { useAutoRefresh } from '~/lib/cache/useAutoRefresh'
import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { communityRoutes, routes } from '~/lib/routes'
import { getPostShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type SavedTypeFilter = 'all' | 'text' | 'media' | 'poll' | 'event' | 'article' | 'celebration' | 'shoppable'

const TYPE_FILTERS: Array<{ id: SavedTypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'shoppable', label: 'Shoppable' },
  { id: 'text', label: 'Updates' },
  { id: 'media', label: 'Media' },
  { id: 'article', label: 'Articles' },
  { id: 'event', label: 'Events' },
  { id: 'celebration', label: 'Celebrations' },
  { id: 'poll', label: 'Polls' },
]

function matchesType(post: SavedCommunityPostEntry['post'], filter: SavedTypeFilter) {
  if (filter === 'all') return true
  if (filter === 'shoppable') return postHasShoppableProducts(post)
  if (filter === 'media') {
    return postHasMedia(post)
  }
  return (post.post_type || 'text') === filter
}

export function SavedPostsScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<SavedCommunityPostEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<SavedTypeFilter>('all')
  const [collectionFilter, setCollectionFilter] = useState('All')
  const [priceDropCount, setPriceDropCount] = useState(0)

  async function reload(silent = false) {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    const result = await fetchSavedCommunityPosts(user.id)
    setItems(result.items)
    setError(result.error)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

  // Saving/unsaving a post anywhere updates this list without a route reload.
  useAutoRefresh([INVALIDATION_TOPICS.savedPosts, INVALIDATION_TOPICS.communityPosts], () => {
    if (authLoading) return
    void reload(true)
  })

  useEffect(() => {
    if (!items.length) {
      setPriceDropCount(0)
      return
    }
    let cancelled = false
    const shoppableEntries = items
      .filter((entry) => postHasShoppableProducts(entry.post))
      .map((entry) => ({
        postId: entry.postId,
        products: entry.post.products?.length ? entry.post.products : entry.post.product ? [entry.post.product] : [],
      }))
    void buildSavedShoppablePriceDropRows(shoppableEntries).then((rows) => {
      if (cancelled) return
      setPriceDropCount(countSavedShoppablePriceDrops(rows))
    })
    return () => {
      cancelled = true
    }
  }, [items])

  const visible = useMemo(() => {
    const collectionScoped =
      collectionFilter === 'All'
        ? items
        : items.filter((entry) => entry.collectionName === collectionFilter)
    const typed = collectionScoped.filter((entry) => matchesType(entry.post, typeFilter))
    return filterBySearchQuery(typed, query, (entry) => [
      entry.post.content,
      entry.post.author?.full_name,
      entry.post.author?.username,
      entry.post.event_title,
      entry.post.post_type,
      entry.collectionName,
      entry.notes,
    ])
  }, [collectionFilter, items, query, typeFilter])
  const sections = useMemo(() => buildSavedPostSections(visible), [visible])
  const collectionNames = useMemo(
    () => ['All', ...new Set(items.map((entry) => entry.collectionName))],
    [items],
  )

  async function handleShareSaved() {
    const posts = visible.slice(0, 8).map((entry) => entry.post)
    if (!posts.length) {
      toast.show('Nothing to share yet', { tone: 'info' })
      return
    }
    const lines = posts.map((post) => {
      const author = post.author?.full_name || post.author?.username || 'Member'
      const snippet = (post.content || post.event_title || 'Saved post').replace(/\s+/g, ' ').slice(0, 80)
      return `• ${author}: ${snippet}${snippet.length >= 80 ? '…' : ''}\n  ${getPostShareUrl(post.id)}`
    })
    const message = [
      `Saved on ${BRAND_NAME}`,
      `${visible.length} post${visible.length === 1 ? '' : 's'}`,
      '',
      ...lines,
    ].join('\n')
    try {
      await Share.share({ title: 'Saved posts', message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Saved list copied' : 'Could not share', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  async function handleUnsave(postId: string) {
    if (!user?.id) return
    const { error: unsaveError } = await unsaveCommunityPost(user.id, postId)
    if (!unsaveError) {
      setItems((prev) => prev.filter((entry) => entry.post.id !== postId))
    }
  }

  return (
    <CommunityShell wide>
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2" flexWrap="wrap">
        <YStack flex={1} minWidth={220}>
          <CommunityPageHeader
            title="Saved posts"
            subtitle="Posts you bookmarked, organized into lightweight creator-pick and revisit lanes"
          />
        </YStack>
        <XStack alignItems="center" gap="$2">
          {visible.length > 0 ? (
            <Button
              size="$3"
              tone="outline"
              borderRadius={999}
              icon={<Icons.Share2 size={15} />}
              onPress={() => void handleShareSaved()}
            >
              Share
            </Button>
          ) : null}
        </XStack>
      </XStack>

      {user ? (
        <YStack gap="$3" width="100%">
          {priceDropCount > 0 ? (
            <XStack
              paddingHorizontal={14}
              paddingVertical={10}
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
              alignItems="center"
              gap={8}
            >
              <Icons.BadgePercent size={16} color="#059669" />
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {priceDropCount} saved shoppable post{priceDropCount === 1 ? '' : 's'} dropped in price
              </Text>
            </XStack>
          ) : null}
          <ScreenSearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search saved posts"
            unifiedScope="posts"
          />
          <HorizontalScrollRow gap={8}>
            {collectionNames.map((collection) => {
              const active = collectionFilter === collection
              return (
                <XStack
                  key={collection}
                  paddingHorizontal={12}
                  paddingVertical={7}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.surfaceMuted : ui.surface}
                  cursor="pointer"
                  onPress={() => setCollectionFilter(collection)}
                >
                  <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
                    {collection}
                  </Text>
                </XStack>
              )
            })}
          </HorizontalScrollRow>
          <HorizontalScrollRow gap={8}>
            {TYPE_FILTERS.map((filter) => {
              const active = typeFilter === filter.id
              return (
                <XStack
                  key={filter.id}
                  paddingHorizontal={12}
                  paddingVertical={7}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.surfaceMuted : ui.surface}
                  cursor="pointer"
                  onPress={() => setTypeFilter(filter.id)}
                >
                  <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
                    {filter.label}
                  </Text>
                </XStack>
              )
            })}
          </HorizontalScrollRow>
        </YStack>
      ) : null}

      {authLoading || loading ? (
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" />
        </YStack>
      ) : !user ? (
        <YStack gap="$3" paddingVertical="$6">
          <Text color={ui.textMuted}>Sign in to save posts for later.</Text>
          <AppLink href={routes.signIn} asChild>
            <Button alignSelf="flex-start" tone="primary" borderRadius={999}>
              Sign in
            </Button>
          </AppLink>
        </YStack>
      ) : error ? (
        <Text color="$red10">{error}</Text>
      ) : items.length === 0 ? (
        <YStack gap="$3" paddingVertical="$6">
          <Icons.Bookmark size={28} color={ui.textMuted} />
          <Text color={ui.textMuted}>
            No saved posts yet. Open any post’s options menu and tap Save post.
          </Text>
          <AppLink href={communityRoutes.home} asChild>
            <Button alignSelf="flex-start" tone="outline" borderRadius={999}>
              Browse feed
            </Button>
          </AppLink>
        </YStack>
      ) : visible.length === 0 ? (
        <YStack gap="$2" paddingVertical="$6" alignItems="center">
          <Icons.Search size={28} color={ui.textMuted} />
          <Text color={ui.textMuted}>No saved posts match this filter.</Text>
        </YStack>
      ) : (
        <YStack gap="$4">
          {sections.map((section) => (
            <YStack key={section.key} gap="$3">
              <YStack gap={4}>
                <Text fontSize={18} fontWeight="800" color={ui.text}>
                  {section.title}
                </Text>
                <Text fontSize={13} color={ui.textMuted}>
                  {section.subtitle}
                </Text>
              </YStack>
              {section.items.map((entry) => (
                <YStack key={entry.postId} gap="$2">
                  <FeedPostCard post={entry.post} />
                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <XStack
                      paddingHorizontal={10}
                      paddingVertical={6}
                      borderRadius={999}
                      backgroundColor={ui.surfaceMuted}
                    >
                      <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                        {entry.collectionName}
                      </Text>
                    </XStack>
                    {entry.notes ? (
                      <Text fontSize={12.5} color={ui.textSecondary}>
                        Note: {entry.notes}
                      </Text>
                    ) : null}
                  </XStack>
                  <Button
                    alignSelf="flex-start"
                    tone="ghost"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.Bookmark size={15} />}
                    onPress={() => void handleUnsave(entry.post.id)}
                  >
                    Remove save
                  </Button>
                </YStack>
              ))}
            </YStack>
          ))}
        </YStack>
      )}
    </CommunityShell>
  )
}
