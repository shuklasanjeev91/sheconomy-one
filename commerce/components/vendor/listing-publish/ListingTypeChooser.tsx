import { Icons, Text, XStack, YStack } from '~/components/ui'
import { LISTING_TYPE_OPTIONS_SELECTABLE } from '~/lib/listing/listing.type'
import type { ListingType } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export function listingTypeIcon(icon: string, color: string) {
  switch (icon) {
    case 'package':
      return <Icons.Package size={22} color={color} />
    case 'download':
      return <Icons.Cloud size={22} color={color} />
    case 'zap':
      return <Icons.Wand2 size={22} color={color} />
    default:
      return <Icons.Box size={22} color={color} />
  }
}

type ListingTypeOptionProps = {
  ui: AppUiTokens
  option: (typeof LISTING_TYPE_OPTIONS_SELECTABLE)[number]
  isDesktop: boolean
  selected: boolean
  onSelect: (type: ListingType) => void
}

export function ListingTypeOption({
  ui,
  option,
  isDesktop,
  selected,
  onSelect,
}: ListingTypeOptionProps) {
  const disabled = option.disabled
  const badge = selected ? (
    <Icons.CheckCircle2 size={18} color={ui.brand} />
  ) : disabled ? (
    <Text fontSize={10} fontWeight="800" color={ui.textMuted} letterSpacing={0.5}>
      SOON
    </Text>
  ) : null

  const frame = {
    borderRadius: 16,
    borderWidth: selected ? 2 : 1,
    borderColor: selected ? ui.brand : ui.borderSubtle,
    backgroundColor: selected ? ui.roseSurface : ui.surface,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? ('not-allowed' as const) : ('pointer' as const),
    onPress: () => {
      if (!disabled) onSelect(option.value)
    },
  }

  // Native/mobile gets a single full-width row per type so nothing is left
  // stranded beside a fixed-width card.
  if (!isDesktop) {
    return (
      <XStack
        {...frame}
        width="100%"
        alignItems="center"
        gap="$3"
        paddingHorizontal="$4"
        paddingVertical="$3.5"
        minHeight={64}
      >
        {listingTypeIcon(option.icon, selected ? ui.brand : ui.textSecondary)}
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {option.label}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
            {option.description}
          </Text>
        </YStack>
        {badge}
      </XStack>
    )
  }

  return (
    <YStack {...frame} flex={1} flexBasis={0} minWidth={220} gap="$2" padding="$4">
      <XStack alignItems="center" justifyContent="space-between">
        {listingTypeIcon(option.icon, selected ? ui.brand : ui.textSecondary)}
        {badge}
      </XStack>
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        {option.label}
      </Text>
      <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
        {option.description}
      </Text>
    </YStack>
  )
}

type ListingTypeChooserProps = {
  ui: AppUiTokens
  isDesktop: boolean
  selected?: ListingType
  onSelect: (type: ListingType) => void
}

/** First screen of the create flow — the rest of the form depends on this. */
export function ListingTypeChooser({ ui, isDesktop, selected, onSelect }: ListingTypeChooserProps) {
  return (
    <YStack gap="$4" width="100%">
      <YStack gap="$1.5">
        <Text
          fontSize={isDesktop ? 28 : 22}
          fontWeight="800"
          color={ui.text}
          letterSpacing={-0.6}
          fontFamily="$heading"
        >
          What are you selling?
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
          Pick a listing type to start. The rest of the form adapts to your choice.
        </Text>
      </YStack>

      <XStack gap="$3" flexWrap="wrap" width="100%" alignItems="stretch">
        {LISTING_TYPE_OPTIONS_SELECTABLE.map((option) => (
          <ListingTypeOption
            key={option.value}
            ui={ui}
            option={option}
            isDesktop={isDesktop}
            selected={selected === option.value}
            onSelect={onSelect}
          />
        ))}
      </XStack>
    </YStack>
  )
}
