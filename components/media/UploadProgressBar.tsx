import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type UploadProgressBarProps = {
  progress: number
  label?: string
  compact?: boolean
}

export function UploadProgressBar({ progress, label, compact }: UploadProgressBarProps) {
  const ui = useAppUi()
  const clamped = Math.max(0, Math.min(100, Math.round(progress)))

  if (clamped <= 0) return null

  return (
    <YStack gap={compact ? 4 : 6} width="100%">
      {label ? (
        <Text fontSize={compact ? 11 : 12} color={ui.textMuted} fontWeight="500">
          {label}
        </Text>
      ) : null}
      <YStack
        height={compact ? 3 : 4}
        borderRadius={999}
        backgroundColor={ui.surfaceMuted}
        overflow="hidden"
        width="100%"
      >
        <YStack height="100%" width={`${clamped}%`} backgroundColor={ui.brand} borderRadius={999} />
      </YStack>
      {!compact ? (
        <Text fontSize={11} color={ui.textMuted}>
          {clamped}%
        </Text>
      ) : null}
    </YStack>
  )
}
