/**
 * Redux Toolkit slice for the listing publication workflow.
 *
 * Replaces the legacy Zustand `listingPublishStore`. It wraps
 * `listingPublishOrchestrator` and turns its progress callbacks into dispatched
 * actions so the UI can render a live, step-by-step progress bar. The workflow
 * is inherently sequential (not optimistic), so there's no rollback registry
 * here — the orchestrator handles DB rollback itself.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import {
  PUBLISH_TOTAL_STEPS,
  listingPublishOrchestrator,
  type PublishListingData,
  type PublishOptions,
  type PublishResult,
  type PublishStep,
  type StepResult,
} from './listing-publish.orchestrator'

// ============= STATE =============

type PublishProgress = {
  currentStep: PublishStep | null
  description: string
  completedSteps: PublishStep[]
  failedSteps: PublishStep[]
  totalSteps: number
  progressPercentage: number
}

type PublishErrorState = { step: string; error: string; timestamp: string } | null

type PublishConfig = { publishImmediately: boolean; rollbackOnFailure: boolean }

type ListingPublishState = {
  isPublishing: boolean
  publishProgress: PublishProgress
  publishResult: PublishResult | null
  publishError: PublishErrorState
  stepResults: Record<string, StepResult>
  publishConfig: PublishConfig
}

const emptyProgress = (): PublishProgress => ({
  currentStep: null,
  description: '',
  completedSteps: [],
  failedSteps: [],
  totalSteps: PUBLISH_TOTAL_STEPS,
  progressPercentage: 0,
})

const initialState: ListingPublishState = {
  isPublishing: false,
  publishProgress: emptyProgress(),
  publishResult: null,
  publishError: null,
  stepResults: {},
  publishConfig: { publishImmediately: true, rollbackOnFailure: true },
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

// ============= THUNKS =============

/**
 * Publish a listing end-to-end. Progress callbacks dispatch the sync actions
 * below so the store reflects each step as it happens; the resolved value is
 * the orchestrator's full `PublishResult`.
 */
export const publishListing = createAsyncThunk<
  PublishResult,
  { listingData: PublishListingData; options?: Partial<PublishOptions> },
  ThunkConfig
>('listingPublish/publish', async ({ listingData, options }, { dispatch, getState }) => {
  const config = getState().listingPublish.publishConfig

  const publishOptions: PublishOptions = {
    ...config,
    ...options,
    onStepProgress: (step, description) => dispatch(stepProgress({ step, description })),
    onStepComplete: (step, result) => dispatch(stepComplete({ step, result })),
    onError: (step, error) =>
      dispatch(
        stepError({ step, error: typeof error === 'string' ? error : (error as Error).message }),
      ),
  }

  return listingPublishOrchestrator.publishListing(listingData, publishOptions)
})

/** Read publishing progress for an existing listing (status / dashboard view). */
export const checkPublishingProgress = createAsyncThunk<StepResult, string, ThunkConfig>(
  'listingPublish/checkProgress',
  async (listingId) => listingPublishOrchestrator.getPublishingProgress(listingId),
)

// ============= SLICE =============

const listingPublishSlice = createSlice({
  name: 'listingPublish',
  initialState,
  reducers: {
    stepProgress(state, action: PayloadAction<{ step: PublishStep; description: string }>) {
      state.publishProgress.currentStep = action.payload.step
      state.publishProgress.description = action.payload.description
    },
    stepComplete(state, action: PayloadAction<{ step: PublishStep; result: StepResult }>) {
      const { step, result } = action.payload
      if (!state.publishProgress.completedSteps.includes(step)) {
        state.publishProgress.completedSteps.push(step)
      }
      state.publishProgress.progressPercentage = Math.round(
        (state.publishProgress.completedSteps.length / state.publishProgress.totalSteps) * 100,
      )
      state.publishProgress.currentStep = null
      state.stepResults[step] = result
    },
    stepError(state, action: PayloadAction<{ step: string; error: string }>) {
      state.publishProgress.failedSteps.push(action.payload.step as PublishStep)
      state.publishProgress.currentStep = null
      state.publishError = {
        step: action.payload.step,
        error: action.payload.error,
        timestamp: new Date().toISOString(),
      }
    },
    updatePublishConfig(state, action: PayloadAction<Partial<PublishConfig>>) {
      state.publishConfig = { ...state.publishConfig, ...action.payload }
    },
    resetPublishState(state) {
      state.isPublishing = false
      state.publishProgress = emptyProgress()
      state.publishResult = null
      state.publishError = null
      state.stepResults = {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(publishListing.pending, (state) => {
        state.isPublishing = true
        state.publishProgress = emptyProgress()
        state.publishResult = null
        state.publishError = null
        state.stepResults = {}
      })
      .addCase(publishListing.fulfilled, (state, action) => {
        state.isPublishing = false
        state.publishResult = action.payload
        if (action.payload.success) state.publishProgress.progressPercentage = 100
        state.publishProgress.currentStep = null
      })
      .addCase(publishListing.rejected, (state, action) => {
        state.isPublishing = false
        state.publishError = {
          step: 'unknown',
          error: action.error.message ?? 'Publication failed.',
          timestamp: new Date().toISOString(),
        }
      })
      .addCase(checkPublishingProgress.fulfilled, (state, action) => {
        state.stepResults.progress_check = action.payload
      })
  },
})

export const {
  stepProgress,
  stepComplete,
  stepError,
  updatePublishConfig,
  resetPublishState,
} = listingPublishSlice.actions

export const listingPublishReducer = listingPublishSlice.reducer

// ============= SELECTORS =============

/** Progress info shaped for progress-bar / status components. */
export function selectPublishProgressInfo(state: RootState) {
  const { publishProgress, isPublishing, publishError, publishResult } = state.listingPublish
  return {
    isPublishing,
    currentStep: publishProgress.currentStep,
    description: publishProgress.description,
    progressPercentage: publishProgress.progressPercentage,
    completedSteps: publishProgress.completedSteps,
    failedSteps: publishProgress.failedSteps,
    totalSteps: publishProgress.totalSteps,
    hasError: Boolean(publishError),
    isComplete: Boolean(publishResult?.success),
    errorMessage: publishError?.error ?? null,
    result: publishResult,
  }
}

/** High-level status flags (can-retry etc.). */
export function selectPublicationStatus(state: RootState) {
  const { isPublishing, publishProgress, publishError, publishResult } = state.listingPublish
  return {
    isActive: isPublishing,
    progress: publishProgress,
    hasError: Boolean(publishError),
    isComplete: Boolean(publishResult?.success),
    canRetry: !isPublishing && Boolean(publishError),
  }
}

/** Compact summary of what was created (counts per child collection). */
export function selectPublicationSummary(state: RootState) {
  const { publishResult, stepResults } = state.listingPublish
  if (!publishResult) return null

  const num = (value: unknown) => (typeof value === 'number' ? value : 0)

  return {
    success: publishResult.success,
    listingId: publishResult.listing_id,
    stepsCompleted: publishResult.steps_completed.length,
    stepsFailed: publishResult.steps_failed.length,
    rollbackPerformed: publishResult.rollback_performed,
    summary: {
      images: num(stepResults.images?.images_processed),
      variations: num(stepResults.variations?.variations_created),
      attributes: num(stepResults.attributes?.attributes_created),
      materials: num(stepResults.materials?.materials_created),
      tags: num(stepResults.tags?.tags_created),
      sections: num(stepResults.shop_sections?.sections_added),
    },
  }
}
