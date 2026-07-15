import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type GetItByChipProps = {
  label: string
}

/** Compact “Get it by …” cue near price (marketplace urgency). */
export function GetItByChip({ label }: GetItByChipProps) {
  const ui = useAppUi()
  const trimmed = label.trim()
  if (!trimmed) return null

  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      alignSelf="flex-start"
      paddingHorizontal="$2.5"
      paddingVertical={6}
      borderRadius={8}
      backgroundColor={ui.badgeSuccessBg}
    >
      <Icons.Truck size={13} color={ui.badgeSuccessText} />
      <Text fontSize={12} fontWeight="700" color={ui.badgeSuccessText}>
        {trimmed.replace(/^Estimated delivery /i, 'Get it by ').replace(/^Est\. arrival /i, 'Get it by ')}
      </Text>
    </XStack>
  )
}
