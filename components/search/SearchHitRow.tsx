import { AppLink } from '~/components/navigation/AppLink'
import { Avatar, Image, Text, XStack, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import type { SearchHit } from '~/lib/search'
import { SEARCH_HIT_KIND_LABELS } from '~/lib/search'
import { useAppUi } from '~/lib/theme/useAppUi'

type SearchHitRowProps = {
  hit: SearchHit
  onPress?: () => void
  /** Kind label on the right. Hidden inside a section that already names the type. */
  showKind?: boolean
  /** Hairline under the row, used inside a grouped card. */
  bordered?: boolean
}

const AVATAR_KINDS = new Set<SearchHit['kind']>(['person', 'company', 'shop', 'group'])

function hitMeta(hit: SearchHit): string {
  const handle = hit.kind === 'person' && hit.username?.trim() ? `@${hit.username.trim()}` : null
  const subtitle = hit.subtitle?.trim() || null
  if (subtitle && handle && subtitle.replace(/^@/, '') !== hit.username?.trim()) {
    return `${subtitle} · ${handle}`
  }
  return subtitle || handle || SEARCH_HIT_KIND_LABELS[hit.kind]
}

function hitPrice(hit: SearchHit): string | null {
  if (hit.kind !== 'listing' || hit.price == null || !Number.isFinite(hit.price)) return null
  return formatCurrency(hit.price, hit.currency || 'INR')
}

export function SearchHitRow({ hit, onPress, showKind = true, bordered = false }: SearchHitRowProps) {
  const ui = useAppUi()
  const kindLabel = SEARCH_HIT_KIND_LABELS[hit.kind]
  const price = hitPrice(hit)
  const roundMedia = AVATAR_KINDS.has(hit.kind)

  return (
    <AppLink href={hit.href as import('one').Href} asChild>
      <XStack
        gap="$3"
        alignItems="center"
        paddingVertical="$3"
        paddingHorizontal="$4"
        minHeight={72}
        cursor="pointer"
        borderBottomWidth={bordered ? 1 : 0}
        borderBottomColor={ui.borderSubtle}
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        pressStyle={{ opacity: 0.92 }}
        onPress={onPress}
        width="100%"
      >
        {roundMedia ? (
          <Avatar name={hit.title} src={hit.imageUrl ?? undefined} size="$6" />
        ) : hit.imageUrl ? (
          <Image
            src={hit.imageUrl}
            width={52}
            height={52}
            borderRadius={12}
            objectFit="cover"
            alt=""
            backgroundColor={ui.surfaceMuted}
          />
        ) : (
          <YStack
            width={52}
            height={52}
            borderRadius={roundMedia ? 999 : 12}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize={13} fontWeight="700" color={ui.textMuted}>
              {kindLabel.slice(0, 1)}
            </Text>
          </YStack>
        )}

        <YStack flex={1} minWidth={0} gap={3}>
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
            {hit.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={1}>
            {hitMeta(hit)}
          </Text>
        </YStack>

        {price ? (
          <Text fontSize={14} fontWeight="700" color={ui.text} flexShrink={0}>
            {price}
          </Text>
        ) : showKind ? (
          <Text
            fontSize={11}
            fontWeight="700"
            color={ui.textMuted}
            backgroundColor={ui.surfaceMuted}
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius={999}
            flexShrink={0}
          >
            {kindLabel}
          </Text>
        ) : null}
      </XStack>
    </AppLink>
  )
}
