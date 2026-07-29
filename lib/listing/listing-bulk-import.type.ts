import type { PublishListingData } from '~/lib/listing/listing-publish.orchestrator'

/** Row lifecycle during bulk import. */
export const BULK_IMPORT_ROW_STATUS = {
  PENDING: 'pending',
  PUBLISHING: 'publishing',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const

export type BulkImportRowStatus =
  (typeof BULK_IMPORT_ROW_STATUS)[keyof typeof BULK_IMPORT_ROW_STATUS]

export type BulkImportRow = {
  id: number
  publishData: PublishListingData
  status: BulkImportRowStatus
  validationErrors: string[]
  currentStep: string | null
  completedSteps: string[]
  progressPct: number
  error: string | null
  listingId: string | null
}

export type BulkImportOverallProgress = {
  total: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
  pct: number
}

export type BulkImportState = {
  shopId: string | null
  fileName: string | null
  parseError: string | null
  rows: BulkImportRow[]
  isImporting: boolean
  isComplete: boolean
  importError: string | null
  overall: BulkImportOverallProgress
}

export type BulkImportRowValidationResult = {
  valid: boolean
  errors: string[]
}

/** Parsed spreadsheet row before normalisation (header → string value). */
export type BulkImportRawRow = Record<string, string>
