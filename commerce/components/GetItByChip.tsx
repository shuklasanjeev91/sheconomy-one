import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type GetItByChipProps = {
  label: string
}

/** Compact “Get it by …” cue near price (marketplace urgency). */
export function GetItByChip({ label }: GetItByChipProps) {
  const ui = useAppUi()
  const trimmed = label.trim()
  // ZIP/pin prompts belong in ShipsToYouWidget — never as a chip.
  if (!trimmed || /enter (pin|zip|postal)|after pin code/i.test(trimmed)) return null

  const display = trimmed
    .replace(/^Estimated delivery /i, 'Get it by ')
    .replace(/^Est\. arrival /i, 'Get it by ')
    .replace(/^Est\. delivery /i, 'Get it by ')
    .replace(/^Get it by Get it by /i, 'Get it by ')

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
        {display}
      </Text>
    </XStack>
  )
}
