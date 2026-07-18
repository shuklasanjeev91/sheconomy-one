import { Text, XStack, YStack } from '~/components/ui'
import type { BulkImportOverallProgress as OverallProgress } from '~/lib/listing/listing-bulk-import.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type BulkImportOverallProgressProps = {
  ui: AppUiTokens
  overall: OverallProgress
  isImporting: boolean
  isComplete: boolean
}

export function BulkImportOverallProgress({
  ui,
  overall,
  isImporting,
  isComplete,
}: BulkImportOverallProgressProps) {
  const { total, succeeded, failed, skipped, pct } = overall
  if (total === 0) return null

  return (
    <YStack
      padding="$4"
      gap="$2"
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={13} fontWeight="600" color={ui.text}>
          {isImporting
            ? `Importing… ${pct}%`
            : isComplete
              ? 'Import complete'
              : `${total} rows ready`}
        </Text>
        <XStack gap="$3">
          <Text fontSize={11} color="#059669" fontWeight="600">
            {succeeded} published
          </Text>
          {failed > 0 ? (
            <Text fontSize={11} color={ui.error} fontWeight="600">
              {failed} failed
            </Text>
          ) : null}
          {skipped > 0 ? (
            <Text fontSize={11} color="#d97706">
              {skipped} skipped
            </Text>
          ) : null}
        </XStack>
      </XStack>
      <YStack height={8} borderRadius={999} backgroundColor={ui.chip} overflow="hidden">
        <YStack
          height="100%"
          width={`${pct}%`}
          borderRadius={999}
          backgroundColor={failed > 0 ? ui.brand : '#10b981'}
        />
      </YStack>
    </YStack>
  )
}
