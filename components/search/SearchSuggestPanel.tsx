import { AppBottomSheet, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { SearchHitRow } from '~/components/search/SearchHitRow'
import type { SearchHit } from '~/lib/search'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type SearchSuggestPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  recent: string[]
  hits: SearchHit[]
  loading: boolean
  onSelectRecent: (term: string) => void
  onClearRecent?: () => void
  onRemoveRecent?: (term: string) => void
  onHitPress?: () => void
}

export function SearchSuggestPanel({
  open,
  onOpenChange,
  query,
  recent,
  hits,
  loading,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
  onHitPress,
}: SearchSuggestPanelProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const trimmed = query.trim()

  const body = (
    <YStack gap="$3" width="100%" paddingBottom="$2" paddingTop="$2">
      {!trimmed && recent.length > 0 ? (
        <YStack gap="$1">
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingBottom="$1"
          >
            <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
              RECENT SEARCHES
            </Text>
            {onClearRecent ? (
              <Text
                fontSize={12}
                fontWeight="600"
                color={ui.brand}
                cursor="pointer"
                onPress={onClearRecent}
              >
                Clear all
              </Text>
            ) : null}
          </XStack>
          {recent.map((term) => (
            <XStack
              key={term}
              paddingHorizontal="$3"
              paddingVertical="$2.5"
              borderRadius={10}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover }}
              onPress={() => onSelectRecent(term)}
              alignItems="center"
              justifyContent="space-between"
              gap="$2"
            >
              <XStack flex={1} minWidth={0} alignItems="center" gap="$2.5">
                <YStack
                  width={32}
                  height={32}
                  borderRadius={999}
                  backgroundColor={ui.surfaceMuted}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icons.Clock size={15} color={ui.textMuted} />
                </YStack>
                <Text flex={1} fontSize={14} fontWeight="500" color={ui.text} numberOfLines={1}>
                  {term}
                </Text>
              </XStack>
              {onRemoveRecent ? (
                <XStack
                  padding="$1.5"
                  cursor="pointer"
                  onPress={() => onRemoveRecent(term)}
                  hitSlop={8}
                >
                  <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                    Remove
                  </Text>
                </XStack>
              ) : null}
            </XStack>
          ))}
        </YStack>
      ) : null}

      {trimmed ? (
        <YStack gap="$1">
          <Text
            fontSize={11}
            fontWeight="800"
            color={ui.textMuted}
            letterSpacing={0.4}
            paddingHorizontal="$3"
            paddingBottom="$1"
          >
            SUGGESTIONS
          </Text>
          {loading ? (
            <YStack padding="$4" alignItems="center">
              <Spinner size="small" />
            </YStack>
          ) : hits.length === 0 ? (
            <Text paddingHorizontal="$3" paddingVertical="$2" fontSize={13} color={ui.textSecondary}>
              No quick matches — hit Search for full results.
            </Text>
          ) : (
            hits.map((hit) => (
              <SearchHitRow
                key={`${hit.kind}-${hit.id}`}
                hit={hit}
                onPress={() => {
                  onHitPress?.()
                  onOpenChange(false)
                }}
              />
            ))
          )}
        </YStack>
      ) : null}

      {!trimmed && recent.length === 0 ? (
        <Text paddingHorizontal="$3" paddingVertical="$2" fontSize={13} color={ui.textSecondary} lineHeight={20}>
          Search listings, shops, people, jobs, programs, and more.
        </Text>
      ) : null}
    </YStack>
  )

  if (isDesktop) {
    if (!open) return null
    return (
      <YStack
        position="absolute"
        top="100%"
        left={0}
        right={0}
        marginTop={8}
        zIndex={400}
        backgroundColor={ui.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        borderRadius={20}
        overflow="hidden"
        maxHeight={440}
        // @ts-expect-error web overflow scroll
        style={{
          boxShadow: '0 16px 48px rgba(16, 12, 14, 0.14)',
          overflowY: 'auto',
        }}
      >
        {body}
      </YStack>
    )
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Search" scrollable>
      {body}
    </AppBottomSheet>
  )
}
