import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getListingImageImportRuleMessages } from '~/lib/config/listing-image-import-rules'
import {
  BULK_IMPORT_REQUIRED_FIELD_HINTS,
} from '~/lib/listing/listing-bulk-import.constants'
import {
  downloadBulkImportCsvTemplate,
  downloadBulkImportExcelTemplate,
} from '~/lib/listing/listing-bulk-import.utils'
import {
  BULK_IMPORT_ROW_STATUS,
} from '~/lib/listing/listing-bulk-import.type'
import {
  parseBulkImportFileThunk,
  resetBulkImport,
  resetBulkImportRow,
  retryFailedBulkImport,
  selectBulkImportSummary,
  setBulkImportShopId,
  skipBulkImportRow,
  startBulkImport,
} from '~/lib/listing/listing-bulk-import.store'
import { loadShopListings } from '~/lib/listing/listing.store'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { BulkImportDropZone } from './BulkImportDropZone'
import { BulkImportOverallProgress } from './BulkImportOverallProgress'
import { BulkImportRowCard } from './BulkImportRowCard'

type BulkImportContentProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
  onImportComplete?: () => void
}

const REQUIRED_HINTS = [
  ...BULK_IMPORT_REQUIRED_FIELD_HINTS,
  ...getListingImageImportRuleMessages(),
]

export function BulkImportContent({ ui, shopId, isDesktop, onImportComplete }: BulkImportContentProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const completionKeyRef = useRef('')

  const {
    rows,
    overall,
    isImporting,
    isComplete,
    parseError,
    importError,
    fileName,
    hasRows,
    pendingCount,
    failedRuntimeCount,
    invalidCount,
  } = useAppSelector(selectBulkImportSummary)

  const isParsing = useAppSelector((s) => s.listingBulkImport.isParsing)

  useEffect(() => {
    dispatch(setBulkImportShopId(shopId))
  }, [dispatch, shopId])

  const handleFile = useCallback(
    (file: File) => {
      void dispatch(parseBulkImportFileThunk({ shopId, file }))
    },
    [dispatch, shopId],
  )

  const handleStartImport = useCallback(() => {
    void dispatch(startBulkImport())
  }, [dispatch])

  const handleRetryFailed = useCallback(() => {
    void dispatch(retryFailedBulkImport())
  }, [dispatch])

  const handleReset = useCallback(() => {
    dispatch(resetBulkImport())
  }, [dispatch])

  useEffect(() => {
    if (!isComplete || overall.succeeded <= 0) return
    const completionKey = `${overall.total}-${overall.succeeded}-${overall.failed}-${overall.skipped}`
    if (completionKeyRef.current === completionKey) return
    completionKeyRef.current = completionKey

    void dispatch(loadShopListings({ shopId }))
    toast.show('Import complete', {
      tone: 'success',
      message: `${overall.succeeded} listing${overall.succeeded === 1 ? '' : 's'} published.`,
    })
    onImportComplete?.()
  }, [dispatch, isComplete, onImportComplete, overall, shopId, toast])

  useEffect(() => {
    if (!isComplete) completionKeyRef.current = ''
  }, [isComplete])

  if (Platform.OS !== 'web') {
    return (
      <YStack padding="$4" gap="$3" alignItems="center">
        <Icons.Upload size={32} color={ui.textMuted} />
        <Text fontSize={14} color={ui.textSecondary} textAlign="center">
          Bulk import is available on web. Open the vendor console in your browser to upload CSV or Excel files.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$4" width="100%">
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
        <YStack gap="$1" flex={1}>
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            Bulk Listing Import
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            Upload a CSV or Excel file to publish multiple listings at once. Each row runs through the same publish
            pipeline as the create-listing wizard.
          </Text>
        </YStack>
        {hasRows && !isImporting ? (
          <Button tone="ghost" size="$2" onPress={handleReset}>
            Start over
          </Button>
        ) : null}
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.Download size={16} color={ui.textSecondary} />}
          onPress={() => void downloadBulkImportExcelTemplate()}
        >
          Excel template
        </Button>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          icon={<Icons.Download size={16} color={ui.textSecondary} />}
          onPress={downloadBulkImportCsvTemplate}
        >
          CSV template
        </Button>
      </XStack>

      {!hasRows ? (
        <BulkImportDropZone ui={ui} onFile={handleFile} disabled={isImporting || isParsing} />
      ) : null}

      {isParsing ? (
        <XStack alignItems="center" gap="$2" padding="$3">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textSecondary}>
            Parsing file…
          </Text>
        </XStack>
      ) : null}

      {parseError ? (
        <YStack
          padding="$3"
          borderRadius={12}
          backgroundColor="rgba(220, 38, 38, 0.08)"
          borderWidth={1}
          borderColor={ui.error}
        >
          <Text fontSize={13} color={ui.error}>
            {parseError}
          </Text>
        </YStack>
      ) : null}

      {hasRows ? (
        <YStack
          padding="$3"
          gap="$2"
          borderRadius={12}
          borderWidth={1}
          borderColor="rgba(217, 119, 6, 0.35)"
          backgroundColor="rgba(217, 119, 6, 0.08)"
        >
          <XStack alignItems="center" gap="$2">
            <Icons.AlertTriangle size={16} color="#b45309" />
            <Text fontSize={13} fontWeight="700" color="#b45309">
              Required fields before publishing
            </Text>
          </XStack>
          <Text fontSize={12} color={ui.textSecondary}>
            Rows missing required data fail validation.
            {invalidCount > 0
              ? ` ${invalidCount} row${invalidCount === 1 ? '' : 's'} currently invalid.`
              : ''}
          </Text>
          <YStack gap="$1" paddingLeft="$2">
            {REQUIRED_HINTS.map((message) => (
              <Text key={message} fontSize={12} color={ui.textSecondary}>
                • {message}
              </Text>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {hasRows && fileName && !isImporting && !isComplete ? (
        <XStack
          alignItems="center"
          justifyContent="space-between"
          padding="$3"
          borderRadius={12}
          backgroundColor={ui.roseSurface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          gap="$2"
        >
          <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
            <Icons.FileText size={16} color={ui.brand} />
            <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
              {fileName}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              · {rows.length} rows
            </Text>
          </XStack>
          <Button tone="ghost" size="$2" onPress={handleReset}>
            Change file
          </Button>
        </XStack>
      ) : null}

      <BulkImportOverallProgress ui={ui} overall={overall} isImporting={isImporting} isComplete={isComplete} />

      {importError ? (
        <Text fontSize={13} color={ui.error}>
          {importError}
        </Text>
      ) : null}

      {hasRows ? (
        <YStack gap="$2">
          <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4} textTransform="uppercase">
            {rows.length} listing{rows.length === 1 ? '' : 's'}
          </Text>
          {rows.map((row) => (
            <BulkImportRowCard
              key={row.id}
              ui={ui}
              row={row}
              isImporting={isImporting}
              onSkip={() => dispatch(skipBulkImportRow(row.id))}
              onRetry={() => dispatch(resetBulkImportRow(row.id))}
              listingHref={
                row.listingId
                  ? (`${String(vendorRoutes.createListing)}?id=${encodeURIComponent(row.listingId)}` as const)
                  : undefined
              }
            />
          ))}
        </YStack>
      ) : null}

      {hasRows ? (
        <XStack gap="$2" flexWrap="wrap" paddingTop="$2">
          {pendingCount > 0 && !isImporting ? (
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              icon={<Icons.Check size={16} color="white" />}
              onPress={handleStartImport}
            >
              Publish {pendingCount} listing{pendingCount === 1 ? '' : 's'}
            </Button>
          ) : null}

          {isImporting ? (
            <Button tone="outline" size="$4" borderRadius={999} disabled icon={<Spinner size="small" />}>
              Importing…
            </Button>
          ) : null}

          {failedRuntimeCount > 0 && !isImporting ? (
            <Button tone="outline" size="$4" borderRadius={999} onPress={handleRetryFailed}>
              Retry {failedRuntimeCount} failed
            </Button>
          ) : null}

          {isComplete && overall.succeeded > 0 ? (
            <YStack
              width="100%"
              padding="$3"
              gap="$2"
              borderRadius={12}
              borderWidth={1}
              borderColor="rgba(16, 185, 129, 0.35)"
              backgroundColor="rgba(16, 185, 129, 0.08)"
            >
              <Text fontSize={13} fontWeight="700" color="#059669">
                {overall.succeeded} listing{overall.succeeded === 1 ? '' : 's'} published successfully.
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Your product list has been refreshed. Close this panel to continue managing inventory.
              </Text>
            </YStack>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  )
}
