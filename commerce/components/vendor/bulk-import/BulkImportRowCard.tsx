import { Text, XStack, YStack } from '~/components/ui'
import {
  BULK_IMPORT_PUBLISH_STEP_KEYS,
} from '~/lib/listing/listing-bulk-import.store'
import { BULK_IMPORT_ROW_STATUS, type BulkImportRow } from '~/lib/listing/listing-bulk-import.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const STATUS_META: Record<
  BulkImportRow['status'],
  { label: string; color: string; bg: string }
> = {
  [BULK_IMPORT_ROW_STATUS.PENDING]: { label: 'Pending', color: '#6b7280', bg: 'transparent' },
  [BULK_IMPORT_ROW_STATUS.PUBLISHING]: { label: 'Publishing', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  [BULK_IMPORT_ROW_STATUS.SUCCESS]: { label: 'Published', color: '#059669', bg: 'rgba(16, 185, 129, 0.08)' },
  [BULK_IMPORT_ROW_STATUS.FAILED]: { label: 'Failed', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
  [BULK_IMPORT_ROW_STATUS.SKIPPED]: { label: 'Skipped', color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' },
}

type BulkImportRowCardProps = {
  ui: AppUiTokens
  row: BulkImportRow
  isImporting: boolean
  onSkip: () => void
  onRetry: () => void
  listingHref?: string
}

export function BulkImportRowCard({
  ui,
  row,
  isImporting,
  onSkip,
  onRetry,
  listingHref,
}: BulkImportRowCardProps) {
  const meta = STATUS_META[row.status]
  const pct = row.progressPct || 0

  return (
    <YStack
      borderWidth={1}
      borderColor={ui.borderSubtle}
      borderRadius={12}
      padding="$3"
      gap="$2"
      backgroundColor={meta.bg}
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Text fontSize={11} color={ui.textMuted} width={24}>
            #{row.id}
          </Text>
          <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1} flex={1}>
            {row.publishData.title || '(no title)'}
          </Text>
          <Text fontSize={11} color={ui.textMuted}>
            {row.publishData.listing_type}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          <Text fontSize={12} fontWeight="600" color={meta.color}>
            {meta.label}
          </Text>
          {listingHref ? (
            <Text
              fontSize={11}
              color={ui.brand}
              cursor="pointer"
              onPress={() => {
                if (typeof window !== 'undefined') window.open(listingHref, '_blank')
              }}
            >
              View ↗
            </Text>
          ) : null}
        </XStack>
      </XStack>

      {row.status === BULK_IMPORT_ROW_STATUS.PUBLISHING ? (
        <YStack gap="$1">
          <XStack justifyContent="space-between">
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1} flex={1}>
              {row.currentStep || '…'}
            </Text>
            <Text fontSize={11} color={ui.textMuted}>
              {pct}%
            </Text>
          </XStack>
          <YStack height={6} borderRadius={999} backgroundColor={ui.chip} overflow="hidden">
            <YStack height="100%" width={`${pct}%`} backgroundColor={ui.brand} borderRadius={999} />
          </YStack>
          <XStack gap={4}>
            {BULK_IMPORT_PUBLISH_STEP_KEYS.map((step) => (
              <YStack
                key={step}
                flex={1}
                height={4}
                borderRadius={999}
                backgroundColor={(row.completedSteps || []).includes(step) ? ui.brand : ui.chip}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}

      {row.status === BULK_IMPORT_ROW_STATUS.FAILED && row.validationErrors.length > 0 ? (
        <YStack gap="$1">
          {row.validationErrors.map((error) => (
            <Text key={error} fontSize={11} color={ui.error}>
              • {error}
            </Text>
          ))}
        </YStack>
      ) : null}

      {row.status === BULK_IMPORT_ROW_STATUS.FAILED && !row.validationErrors.length && row.error ? (
        <Text fontSize={11} color={ui.error}>
          {row.error}
        </Text>
      ) : null}

      {!isImporting ? (
        <XStack gap="$2" justifyContent="flex-end">
          {row.status === BULK_IMPORT_ROW_STATUS.PENDING ? (
            <Text fontSize={11} color={ui.textMuted} cursor="pointer" onPress={onSkip}>
              Skip
            </Text>
          ) : null}
          {row.status === BULK_IMPORT_ROW_STATUS.SKIPPED ||
          (row.status === BULK_IMPORT_ROW_STATUS.FAILED && !row.validationErrors.length) ? (
            <Text fontSize={11} color={ui.brand} cursor="pointer" onPress={onRetry}>
              Retry
            </Text>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  )
}
