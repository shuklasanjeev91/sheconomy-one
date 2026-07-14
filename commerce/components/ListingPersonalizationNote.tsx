import { Text, TextArea, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingPersonalizationNoteProps = {
  value: string
  onChange: (value: string) => void
  /** Max chars buyers can send with the order. */
  maxLength?: number
}

/** Optional personalization / gift note (marketplace “Add a note to seller”). */
export function ListingPersonalizationNote({
  value,
  onChange,
  maxLength = 400,
}: ListingPersonalizationNoteProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$2" width="100%">
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        Add a note to seller (optional)
      </Text>
      <TextArea
        value={value}
        onChangeText={(next) => onChange(next.slice(0, maxLength))}
        placeholder="Initials, color preference, gift message…"
        minHeight={88}
        maxLength={maxLength}
      />
      <Text fontSize={11} color={ui.textMuted}>
        {value.length}/{maxLength}
      </Text>
    </YStack>
  )
}
