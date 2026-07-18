import { Text, XStack, YStack } from 'tamagui'

import { Spinner } from '~/components/ui/Spinner'
import { useAppUi } from '~/lib/theme/useAppUi'

type ActionProgressProps = {
  /** Accessible status text shown to the user while a long action runs. */
  label: string
  /** Optional 0–100 progress; omit for indeterminate. */
  progress?: number | null
  cancelLabel?: string
  onCancel?: () => void
  cancelling?: boolean
}

/**
 * Visible + accessible progress for uploads, checkout, media send, recording, etc.
 */
export function ActionProgress({
  label,
  progress,
  cancelLabel = 'Cancel',
  onCancel,
  cancelling,
}: ActionProgressProps) {
  const ui = useAppUi()
  const pct =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius="$4"
      borderWidth={1}
      borderColor={ui.border}
      backgroundColor={ui.surface}
      accessibilityRole="progressbar"
      accessibilityLabel={pct != null ? `${label}, ${pct} percent` : label}
      accessibilityValue={pct != null ? { now: pct, min: 0, max: 100 } : undefined}
    >
      <XStack alignItems="center" gap="$3">
        <Spinner size="small" color={ui.brand} />
        <Text flex={1} fontSize={14} fontWeight="600" color={ui.text}>
          {cancelling ? 'Cancelling…' : label}
          {pct != null ? ` · ${pct}%` : ''}
        </Text>
        {onCancel && !cancelling ? (
          <Text
            fontSize={14}
            fontWeight="700"
            color={ui.brand}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            cursor="pointer"
            paddingVertical="$2"
            paddingHorizontal="$2"
            minHeight={44}
          >
            {cancelLabel}
          </Text>
        ) : null}
      </XStack>
      {pct != null ? (
        <YStack height={4} borderRadius={999} backgroundColor={ui.surfaceMuted} overflow="hidden">
          <YStack height="100%" width={`${pct}%`} backgroundColor={ui.brand} borderRadius={999} />
        </YStack>
      ) : null}
    </YStack>
  )
}
