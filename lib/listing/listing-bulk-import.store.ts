/**
 * Redux slice for bulk listing import (CSV / Excel).
 *
 * Replaces the legacy Zustand `listingBulkImportStore`. Parses spreadsheet rows,
 * validates them client-side, then publishes each row via `listingPublishOrchestrator`.
 * Progress is tracked per-row — not optimistic (each publish is sequential batches).
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import { BULK_IMPORT_CONFIG } from '~/lib/listing/listing-bulk-import.constants'
import { formatBulkImportParseError, toBulkImportRowError } from '~/lib/listing/listing-bulk-import.errors'
import {
  BULK_IMPORT_ROW_STATUS,
  type BulkImportOverallProgress,
  type BulkImportRow,
  type BulkImportRowStatus,
} from '~/lib/listing/listing-bulk-import.type'
import {
  assertBulkImportFileName,
  assertBulkImportFileSize,
} from '~/lib/listing/listing-bulk-import.validation'
import {
  buildBulkImportRows,
  parseBulkImportFile,
  recalcBulkImportOverall,
} from '~/lib/listing/listing-bulk-import.utils'
import {
  listingPublishOrchestrator,
  type PublishStep,
} from '~/lib/listing/listing-publish.orchestrator'

// ============= STATE =============

type ListingBulkImportState = {
  shopId: string | null
  fileName: string | null
  parseError: string | null
  rows: BulkImportRow[]
  isImporting: boolean
  isParsing: boolean
  isComplete: boolean
  importError: string | null
  overall: BulkImportOverallProgress
}

const emptyOverall = (): BulkImportOverallProgress => ({
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  pct: 0,
})

const initialState: ListingBulkImportState = {
  shopId: null,
  fileName: null,
  parseError: null,
  rows: [],
  isImporting: false,
  isParsing: false,
  isComplete: false,
  importError: null,
  overall: emptyOverall(),
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

// ============= THUNKS =============

export const parseBulkImportFileThunk = createAsyncThunk<
  BulkImportRow[],
  { shopId: string; file: File },
  ThunkConfig
>('listingBulkImport/parseFile', async ({ shopId, file }, { rejectWithValue }) => {
  const nameError = assertBulkImportFileName(file.name)
  if (nameError) return rejectWithValue(nameError)

  const sizeError = assertBulkImportFileSize(file.size)
  if (sizeError) return rejectWithValue(sizeError)

  try {
    const rawRows = await parseBulkImportFile(file)
    if (rawRows.length === 0) {
      return rejectWithValue('File is empty or has no data rows.')
    }
    return buildBulkImportRows(rawRows, shopId)
  } catch (error) {
    return rejectWithValue(formatBulkImportParseError(error))
  }
})

async function publishBulkImportRow(
  row: BulkImportRow,
  dispatch: AppDispatch,
): Promise<BulkImportRow> {
  dispatch(
    patchBulkImportRow({
      id: row.id,
      patch: {
        status: BULK_IMPORT_ROW_STATUS.PUBLISHING,
        currentStep: 'Starting…',
      },
    }),
  )

  try {
    const result = await listingPublishOrchestrator.publishListing(row.publishData, {
      publishImmediately: true,
      rollbackOnFailure: true,
      onStepProgress: (_step, description) => {
        dispatch(
          patchBulkImportRow({
            id: row.id,
            patch: { currentStep: description || 'Publishing…' },
          }),
        )
      },
      onStepComplete: (step) => {
        dispatch(
          patchBulkImportRow({
            id: row.id,
            patchFn: (current) => {
              const completed = [...current.completedSteps, step]
              return {
                completedSteps: completed,
                progressPct: Math.min(
                  BULK_IMPORT_CONFIG.PROGRESS_CAP,
                  completed.length * BULK_IMPORT_CONFIG.PROGRESS_STEP_WEIGHT,
                ),
              }
            },
          }),
        )
      },
      onError: (_step, error) => {
        const message = typeof error === 'string' ? error : (error as Error)?.message
        dispatch(
          patchBulkImportRow({
            id: row.id,
            patch: { currentStep: message ? `Error: ${message}` : 'Error' },
          }),
        )
      },
    })

    if (result.success) {
      return {
        ...row,
        status: BULK_IMPORT_ROW_STATUS.SUCCESS,
        listingId: result.listing_id,
        progressPct: 100,
        currentStep: null,
        completedSteps: result.steps_completed ?? [],
        error: null,
      }
    }

    const failedStep =
      Array.isArray(result.steps_failed) && result.steps_failed.length > 0
        ? result.steps_failed[result.steps_failed.length - 1]
        : null

    const rawError =
      typeof result.error_details === 'string'
        ? result.error_details
        : (result.error_details as { message?: string } | null)?.message

    return {
      ...row,
      status: BULK_IMPORT_ROW_STATUS.FAILED,
      error: toBulkImportRowError(rawError, failedStep),
      currentStep: null,
    }
  } catch (error) {
    return {
      ...row,
      status: BULK_IMPORT_ROW_STATUS.FAILED,
      error: toBulkImportRowError(error),
      currentStep: null,
    }
  }
}

export const startBulkImport = createAsyncThunk<void, void, ThunkConfig>(
  'listingBulkImport/start',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const { shopId, rows, isImporting } = getState().listingBulkImport
    if (isImporting) return
    if (!shopId) return rejectWithValue('No shop selected.')

    const pending = rows.filter((r) => r.status === BULK_IMPORT_ROW_STATUS.PENDING)
    if (pending.length === 0) return

    for (let i = 0; i < pending.length; i += BULK_IMPORT_CONFIG.CONCURRENCY) {
      const batch = pending.slice(i, i + BULK_IMPORT_CONFIG.CONCURRENCY)
      const results = await Promise.all(batch.map((row) => publishBulkImportRow(row, dispatch)))
      results.forEach((updated) => {
        dispatch(patchBulkImportRow({ id: updated.id, patch: updated }))
      })
      dispatch(recalcBulkImportOverallAction())
    }
  },
)

export const retryFailedBulkImport = createAsyncThunk<void, void, ThunkConfig>(
  'listingBulkImport/retryFailed',
  async (_, { getState, dispatch }) => {
    const { rows } = getState().listingBulkImport
    rows
      .filter(
        (r) => r.status === BULK_IMPORT_ROW_STATUS.FAILED && r.validationErrors.length === 0,
      )
      .forEach((row) => {
        dispatch(
          patchBulkImportRow({
            id: row.id,
            patch: {
              status: BULK_IMPORT_ROW_STATUS.PENDING,
              error: null,
              validationErrors: [],
              completedSteps: [],
              progressPct: 0,
              currentStep: null,
            },
          }),
        )
      })
    dispatch(recalcBulkImportOverallAction())
    await dispatch(startBulkImport())
  },
)

// ============= SLICE =============

const listingBulkImportSlice = createSlice({
  name: 'listingBulkImport',
  initialState,
  reducers: {
    setBulkImportShopId(state, action: PayloadAction<string | null>) {
      state.shopId = action.payload
    },
    resetBulkImport(state) {
      Object.assign(state, {
        ...initialState,
        shopId: state.shopId,
      })
    },
    skipBulkImportRow(state, action: PayloadAction<number>) {
      const row = state.rows.find((r) => r.id === action.payload)
      if (row && row.status === BULK_IMPORT_ROW_STATUS.PENDING) {
        row.status = BULK_IMPORT_ROW_STATUS.SKIPPED
      }
      state.overall = recalcBulkImportOverall(state.rows)
    },
    resetBulkImportRow(state, action: PayloadAction<number>) {
      const row = state.rows.find((r) => r.id === action.payload)
      if (
        row &&
        (row.status === BULK_IMPORT_ROW_STATUS.SKIPPED ||
          row.status === BULK_IMPORT_ROW_STATUS.FAILED)
      ) {
        row.status = BULK_IMPORT_ROW_STATUS.PENDING
        row.error = null
        row.validationErrors = []
        row.completedSteps = []
        row.progressPct = 0
        row.currentStep = null
      }
      state.overall = recalcBulkImportOverall(state.rows)
    },
    patchBulkImportRow(
      state,
      action: PayloadAction<{
        id: number
        patch?: Partial<BulkImportRow>
        patchFn?: (row: BulkImportRow) => Partial<BulkImportRow>
      }>,
    ) {
      const index = state.rows.findIndex((r) => r.id === action.payload.id)
      if (index === -1) return
      const current = state.rows[index]
      const nextPatch = action.payload.patchFn
        ? action.payload.patchFn(current)
        : action.payload.patch ?? {}
      state.rows[index] = { ...current, ...nextPatch }
    },
    recalcBulkImportOverallAction(state) {
      state.overall = recalcBulkImportOverall(state.rows)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(parseBulkImportFileThunk.pending, (state, action) => {
        state.isParsing = true
        state.parseError = null
        state.fileName = action.meta.arg.file.name
        state.rows = []
        state.isComplete = false
        state.importError = null
        state.overall = emptyOverall()
      })
      .addCase(parseBulkImportFileThunk.fulfilled, (state, action) => {
        state.isParsing = false
        state.rows = action.payload
        state.overall = recalcBulkImportOverall(state.rows)
      })
      .addCase(parseBulkImportFileThunk.rejected, (state, action) => {
        state.isParsing = false
        state.parseError = action.payload ?? action.error.message ?? 'Parse failed.'
        state.rows = []
        state.overall = emptyOverall()
      })
      .addCase(startBulkImport.pending, (state) => {
        state.isImporting = true
        state.isComplete = false
        state.importError = null
      })
      .addCase(startBulkImport.fulfilled, (state) => {
        state.isImporting = false
        state.isComplete = true
        state.overall = recalcBulkImportOverall(state.rows)
      })
      .addCase(startBulkImport.rejected, (state, action) => {
        state.isImporting = false
        state.importError = action.payload ?? action.error.message ?? 'Import failed.'
      })
      .addCase(retryFailedBulkImport.pending, (state) => {
        state.isImporting = true
        state.isComplete = false
      })
      .addCase(retryFailedBulkImport.fulfilled, (state) => {
        state.isImporting = false
        state.isComplete = true
      })
  },
})

export const {
  setBulkImportShopId,
  resetBulkImport,
  skipBulkImportRow,
  resetBulkImportRow,
  patchBulkImportRow,
  recalcBulkImportOverallAction,
} = listingBulkImportSlice.actions

export const listingBulkImportReducer = listingBulkImportSlice.reducer

// ============= SELECTORS =============

export function selectBulkImportState(state: RootState) {
  return state.listingBulkImport
}

export function selectBulkImportSummary(state: RootState) {
  const { rows, overall, isImporting, isComplete, parseError, importError, fileName } =
    state.listingBulkImport
  const pendingCount = rows.filter((r) => r.status === BULK_IMPORT_ROW_STATUS.PENDING).length
  const failedRuntimeCount = rows.filter(
    (r) => r.status === BULK_IMPORT_ROW_STATUS.FAILED && r.validationErrors.length === 0,
  ).length
  const invalidCount = rows.filter(
    (r) => r.status === BULK_IMPORT_ROW_STATUS.FAILED && r.validationErrors.length > 0,
  ).length

  return {
    rows,
    overall,
    isImporting,
    isComplete,
    parseError,
    importError,
    fileName,
    hasRows: rows.length > 0,
    pendingCount,
    failedRuntimeCount,
    invalidCount,
  }
}

/** Human labels for orchestrator steps shown in the row progress UI. */
export const BULK_IMPORT_STEP_LABELS: Record<Exclude<PublishStep, 'completed'>, string> = {
  validation: 'Validating',
  main_listing: 'Creating listing',
  images: 'Uploading images',
  categories: 'Assigning categories',
  variations: 'Adding variations',
  attributes: 'Adding attributes',
  materials: 'Adding materials',
  tags: 'Tagging',
  shop_sections: 'Adding to sections',
  indexing: 'Indexing',
}

export const BULK_IMPORT_PUBLISH_STEP_KEYS = Object.keys(
  BULK_IMPORT_STEP_LABELS,
) as (keyof typeof BULK_IMPORT_STEP_LABELS)[]
