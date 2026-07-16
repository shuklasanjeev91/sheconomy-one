import { AdaptiveTypeaheadPanel } from '~/components/search/AdaptiveTypeaheadPanel'
import { SuggestSectionHeader } from '~/components/search/SuggestSectionHeader'
import { SuggestProfileRow } from '~/community/components/SuggestProfileRow'
import type { MentionHashtagSuggestionState } from '~/community/hooks/useMentionHashtagSuggestions'
import type { HashtagSuggestion, ProfileSuggestion } from '~/community/lib/network'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type MentionHashtagSuggestPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'mention' | 'hashtag'
  query: string
  onQueryChange?: (value: string) => void
  results: MentionHashtagSuggestionState
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  placement?: 'top' | 'bottom'
  onSelectProfile: (profile: ProfileSuggestion) => void
  onSelectHashtag: (tag: string) => void
  onLoadMore: () => void
}

export function MentionHashtagSuggestPanel({
  open,
  onOpenChange,
  kind,
  query,
  onQueryChange,
  results,
  loading,
  loadingMore,
  error,
  hasMore,
  placement = 'bottom',
  onSelectProfile,
  onSelectHashtag,
  onLoadMore,
}: MentionHashtagSuggestPanelProps) {
  const ui = useAppUi()
  const title = kind === 'mention' ? 'Mention someone' : 'Add hashtag'
  const sectionLabel = kind === 'mention' ? 'PEOPLE' : 'HASHTAGS'
  const canLoadMore = hasMore && !loading && !loadingMore && Boolean(results?.items.length)

  const body = (
    <YStack gap="$2" width="100%" paddingBottom="$2" paddingTop="$2">
      <SuggestSectionHeader label={sectionLabel} />

      {loading && (!results || results.items.length === 0) ? (
        <YStack padding="$4" alignItems="center" gap="$2">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textMuted}>
            Searching…
          </Text>
        </YStack>
      ) : null}

      {error ? (
        <Text paddingHorizontal="$3" paddingVertical="$2" fontSize={13} color={ui.danger ?? '#b91c1c'}>
          {error}
        </Text>
      ) : null}

      {!loading && results?.kind === 'mention'
        ? results.items.map((profile) => (
            <SuggestProfileRow
              key={profile.id}
              profile={profile}
              onPress={() => {
                onSelectProfile(profile)
                onOpenChange(false)
              }}
            />
          ))
        : null}

      {!loading && results?.kind === 'hashtag'
        ? results.items.map((item: HashtagSuggestion) => (
            <YStack
              key={item.tag}
              paddingVertical="$2.5"
              paddingHorizontal="$3"
              borderRadius={10}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover }}
              pressStyle={{ opacity: 0.92 }}
              onPress={() => {
                onSelectHashtag(item.tag)
                onOpenChange(false)
              }}
            >
              <XStack gap="$2" alignItems="center">
                <Icons.Hash size={16} color={ui.brand} />
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={14} fontWeight="600" color={ui.text} numberOfLines={1}>
                    #{item.tag}
                  </Text>
                  {item.usage_count != null && item.usage_count > 0 ? (
                    <Text fontSize={12} color={ui.textMuted}>
                      {item.usage_count.toLocaleString()} posts
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
            </YStack>
          ))
        : null}

      {!loading && results && results.items.length === 0 && !error ? (
        <Text paddingHorizontal="$3" paddingVertical="$2" fontSize={13} color={ui.textSecondary}>
          {query.trim()
            ? kind === 'mention'
              ? 'No people found — try another name.'
              : 'No hashtags found — try another tag.'
            : kind === 'mention'
              ? 'Type a name to find people in your network.'
              : 'Type to browse popular hashtags.'}
        </Text>
      ) : null}

      {loadingMore ? (
        <YStack paddingVertical="$3" alignItems="center">
          <Spinner size="small" />
        </YStack>
      ) : null}
    </YStack>
  )

  return (
    <AdaptiveTypeaheadPanel
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      placement={placement}
      maxHeight={480}
      zIndex={1000}
      searchValue={query}
      onSearchChange={onQueryChange}
      searchPlaceholder={kind === 'mention' ? 'Search people' : 'Search hashtags'}
      showSearchOnDesktop
      onScrollNearEnd={onLoadMore}
      scrollNearEndEnabled={canLoadMore}
      scrollNearEndLoading={loadingMore}
    >
      {body}
    </AdaptiveTypeaheadPanel>
  )
}
