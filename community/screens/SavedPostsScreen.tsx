import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Share } from 'react-native'

import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import type { CommunityPost } from '~/community/lib/community'
import { postHasMedia } from '~/community/lib/post-media'
import { fetchSavedCommunityPosts, unsaveCommunityPost } from '~/community/lib/saved-posts'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { communityRoutes, routes } from '~/lib/routes'
import { getPostShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type SavedTypeFilter = 'all' | 'text' | 'media' | 'poll' | 'event' | 'article'

const TYPE_FILTERS: Array<{ id: SavedTypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'text', label: 'Updates' },
  { id: 'media', label: 'Media' },
  { id: 'poll', label: 'Polls' },
  { id: 'event', label: 'Events' },
  { id: 'article', label: 'Articles' },
]

function matchesType(post: CommunityPost, filter: SavedTypeFilter) {
  if (filter === 'all') return true
  if (filter === 'media') {
    return postHasMedia(post)
  }
  return (post.post_type || 'text') === filter
}

export function SavedPostsScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user, isLoading: authLoading } = useSupabase()
  const [items, setItems] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<SavedTypeFilter>('all')

  async function reload() {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((post) => {
      if (!matchesType(post, typeFilter)) return false
      if (!needle) return true
      const haystack = [
        post.content,
        post.author?.full_name,
        post.author?.username,
        post.event_title,
        post.post_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [items, query, typeFilter])

  async function handleShareSaved() {
    const posts = visible.slice(0, 8)
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
      setItems((prev) => prev.filter((post) => post.id !== postId))
    }
  }

  return (
    <CommunityShell wide>
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2" flexWrap="wrap">
        <YStack flex={1} minWidth={220}>
          <CommunityPageHeader
            title="Saved posts"
            subtitle="Posts you bookmarked to revisit later"
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
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            minHeight={44}
            borderRadius={999}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
          >
            <Icons.Search size={16} color={ui.textMuted} />
            <Input
              flex={1}
              value={query}
              onChangeText={setQuery}
              placeholder="Search saved posts"
              borderWidth={0}
              backgroundColor="transparent"
              height={40}
              fontSize={14}
              paddingHorizontal={0}
            />
          </XStack>
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
          {visible.map((post) => (
            <YStack key={post.id} gap="$2">
              <FeedPostCard post={post} />
              <Button
                alignSelf="flex-start"
                tone="ghost"
                size="$3"
                borderRadius={999}
                icon={<Icons.Bookmark size={15} />}
                onPress={() => void handleUnsave(post.id)}
              >
                Remove save
              </Button>
            </YStack>
          ))}
        </YStack>
      )}
    </CommunityShell>
  )
}
