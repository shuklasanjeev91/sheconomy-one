/**
 * Redux Toolkit slice for Sale Events.
 *
 * Replaces the legacy Zustand `sales.event-store`. Async work lives in
 * `createAsyncThunk`s that wrap `sale.service`; vendor join/withdraw and admin
 * accept/reject apply **optimistically** and roll back on failure (same pattern
 * as profile / shop / cms). Snapshots for rollback are kept OUTSIDE Redux state
 * (keyed by the thunk `requestId`) so state stays serializable.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch } from '~/lib/store'

import * as saleService from './sale-event.service'
import {
  ENROLLMENT_STATUS,
  type CategoryPickerParams,
  type EnrolledEventDiscount,
  type EnrollmentDecision,
  type EventOffer,
  type ListingPickerParams,
  type SaleCategoryOption,
  type SaleEventDetail,
  type SaleEventForVendor,
  type SaleEventWithCounts,
  type SaleListingOption,
  type SaleServiceResponse,
  type SaleShopRef,
  type VendorEnrollment,
} from './sale-event.type'
import {
  attachOfferCategoriesSchema,
  attachOfferListingsSchema,
  categoryQuerySchema,
  createEventOfferSchema,
  createEventSchema,
  listingPickerQuerySchema,
  parseOrThrow,
  updateEnrollmentStatusSchema,
  updateEventSchema,
  vendorEnrollSchema,
} from './sale-event.validation'
import { formatEnrollments, normalizeOfferPayload } from './sale-event.utils'

// ============= STATE =============

/**
 * Enrollment rows differ by caller: admin lists carry `shops`, vendor lists
 * carry `sale_events` + `canWithdraw`. This union covers both plus optimistic.
 */
export type SaleEnrollmentRow = VendorEnrollment & {
  shops?: SaleShopRef | null
  sale_events?: {
    id: string
    event_name: string
    event_slug: string
    description: string | null
    start_date: string
    end_date: string
    banner_image: string | null
    status: string
  } | null
  canWithdraw?: boolean
  _optimistic?: boolean
}

type OfferLinkRow = { id: string; category_id: string }
type OfferListingLinkRow = { id: string; listing_id: string }

type SaleState = {
  /** Admin event list (with aggregate counts). */
  events: SaleEventWithCounts[]
  /** Active events for vendor discovery. */
  activeEvents: SaleEventForVendor[]
  /** Currently viewed / edited event detail. */
  currentEvent: SaleEventDetail | null
  /** Offers for the currently open event. */
  offers: EventOffer[]
  /** Enrollments — admin (per event) or vendor (per shop) depending on caller. */
  enrollments: SaleEnrollmentRow[]
  /** Event-sourced discount profiles for a vendor's shop. */
  enrolledEventDiscounts: EnrolledEventDiscount[]
  /** Category picker results. */
  categories: SaleCategoryOption[]
  /** Product picker results. */
  pickerListings: SaleListingOption[]
  /** Category ids already attached to the open offer (edit mode). */
  offerCategories: OfferLinkRow[]
  /** Listing ids already attached to the open offer (edit mode). */
  offerListings: OfferListingLinkRow[]

  error: string | null
  successMessage: string | null

  isLoadingEvents: boolean
  isLoadingActiveEvents: boolean
  isLoadingEvent: boolean
  isSavingEvent: boolean
  isDeletingEvent: boolean
  isSavingOffer: boolean
  isLoadingEnrollments: boolean
  isEnrolling: boolean
  isUpdatingEnrollment: boolean
  isLoadingCategories: boolean
  isLoadingListings: boolean
  isLoadingDiscounts: boolean
  isUploadingBanner: boolean
}

const initialState: SaleState = {
  events: [],
  activeEvents: [],
  currentEvent: null,
  offers: [],
  enrollments: [],
  enrolledEventDiscounts: [],
  categories: [],
  pickerListings: [],
  offerCategories: [],
  offerListings: [],

  error: null,
  successMessage: null,

  isLoadingEvents: false,
  isLoadingActiveEvents: false,
  isLoadingEvent: false,
  isSavingEvent: false,
  isDeletingEvent: false,
  isSavingOffer: false,
  isLoadingEnrollments: false,
  isEnrolling: false,
  isUpdatingEnrollment: false,
  isLoadingCategories: false,
  isLoadingListings: false,
  isLoadingDiscounts: false,
  isUploadingBanner: false,
}

// ============= ROLLBACK REGISTRY (outside Redux — non-serializable-safe) =============

const rollbackRegistry = new Map<string, unknown>()

function stashRollback(requestId: string, snapshot: unknown): void {
  rollbackRegistry.set(requestId, snapshot)
}

function takeRollback<T>(requestId: string): T | undefined {
  const snapshot = rollbackRegistry.get(requestId) as T | undefined
  rollbackRegistry.delete(requestId)
  return snapshot
}

function tempId(requestId: string): string {
  return `optimistic-${requestId}`
}

// ============= THUNK PLUMBING =============

type ThunkConfig = { rejectValue: string; dispatch: AppDispatch; state: { sale: SaleState } }

async function resolve<T>(
  promise: Promise<SaleServiceResponse<T>>,
  rejectWithValue: (value: string) => unknown,
): Promise<{ data: T; meta?: SaleServiceResponse<T>['meta'] }> {
  const response = await promise
  if (!response.success || response.data === null) {
    return rejectWithValue(response.error ?? 'Request failed.') as never
  }
  return { data: response.data, meta: response.meta }
}

// ============= EVENT THUNKS (admin) =============

export const loadEvents = createAsyncThunk<SaleEventWithCounts[], void, ThunkConfig>(
  'sale/loadEvents',
  async (_, { rejectWithValue }) => (await resolve(saleService.getAllEvents(), rejectWithValue)).data,
)

export const loadEventById = createAsyncThunk<SaleEventDetail, string, ThunkConfig>(
  'sale/loadEventById',
  async (id, { rejectWithValue }) => (await resolve(saleService.getEventById(id), rejectWithValue)).data,
)

export const loadEventBySlug = createAsyncThunk<SaleEventDetail, string, ThunkConfig>(
  'sale/loadEventBySlug',
  async (slug, { rejectWithValue }) =>
    (await resolve(saleService.getEventBySlug(slug), rejectWithValue)).data,
)

export const createEvent = createAsyncThunk<SaleEventWithCounts, unknown, ThunkConfig>(
  'sale/createEvent',
  async (payload, { rejectWithValue }) => {
    try {
      const validated = parseOrThrow(createEventSchema, payload)
      const { data } = await resolve(saleService.createSaleEvent(validated), rejectWithValue)
      return { ...data, offer_count: 0, enrollment_count: 0, accepted_count: 0 }
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create failed.')
    }
  },
)

export const updateEvent = createAsyncThunk<
  SaleEventWithCounts,
  { eventId: string; payload: unknown },
  ThunkConfig
>('sale/updateEvent', async ({ eventId, payload }, { getState, rejectWithValue }) => {
  try {
    const validated = parseOrThrow(updateEventSchema, payload)
    const { data } = await resolve(saleService.updateSaleEvent(eventId, validated), rejectWithValue)
    const existing = getState().sale.events.find((e) => e.id === eventId)
    return {
      ...data,
      offer_count: existing?.offer_count ?? 0,
      enrollment_count: existing?.enrollment_count ?? 0,
      accepted_count: existing?.accepted_count ?? 0,
    }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Update failed.')
  }
})

export const deleteEvent = createAsyncThunk<string, string, ThunkConfig>(
  'sale/deleteEvent',
  async (eventId, { rejectWithValue }) => {
    const response = await saleService.deleteSaleEvent(eventId)
    if (!response.success) return rejectWithValue(response.error ?? 'Delete failed.')
    return eventId
  },
)

// ============= OFFER THUNKS (admin) =============

export const createOffer = createAsyncThunk<EventOffer, unknown, ThunkConfig>(
  'sale/createOffer',
  async (payload, { rejectWithValue }) => {
    try {
      const normalized = normalizeOfferPayload(payload as Record<string, unknown>)
      const validated = parseOrThrow(createEventOfferSchema, normalized)
      const { data } = await resolve(saleService.createEventOffer(validated), rejectWithValue)
      return data
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Create offer failed.')
    }
  },
)

export const attachCategoriesToOffer = createAsyncThunk<
  { count: number },
  { offerId: string; categoryIds: string[] },
  ThunkConfig
>('sale/attachCategoriesToOffer', async ({ offerId, categoryIds }, { rejectWithValue }) => {
  try {
    parseOrThrow(attachOfferCategoriesSchema, { offer_id: offerId, category_ids: categoryIds })
    const { data } = await resolve(
      saleService.attachOfferCategories(offerId, categoryIds),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to attach categories.')
  }
})

export const attachListingsToOffer = createAsyncThunk<
  { count: number },
  { offerId: string; listingIds: string[] },
  ThunkConfig
>('sale/attachListingsToOffer', async ({ offerId, listingIds }, { rejectWithValue }) => {
  try {
    parseOrThrow(attachOfferListingsSchema, { offer_id: offerId, listing_ids: listingIds })
    const { data } = await resolve(
      saleService.attachOfferListings(offerId, listingIds),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to attach listings.')
  }
})

export const replaceOfferCategories = createAsyncThunk<
  { count: number },
  { offerId: string; categoryIds: string[] },
  ThunkConfig
>('sale/replaceOfferCategories', async ({ offerId, categoryIds }, { rejectWithValue }) => {
  const { data } = await resolve(
    saleService.replaceOfferCategories(offerId, categoryIds),
    rejectWithValue,
  )
  return data
})

export const replaceOfferListings = createAsyncThunk<
  { count: number },
  { offerId: string; listingIds: string[] },
  ThunkConfig
>('sale/replaceOfferListings', async ({ offerId, listingIds }, { rejectWithValue }) => {
  const { data } = await resolve(
    saleService.replaceOfferListings(offerId, listingIds),
    rejectWithValue,
  )
  return data
})

export const loadOfferCategories = createAsyncThunk<OfferLinkRow[], string, ThunkConfig>(
  'sale/loadOfferCategories',
  async (offerId, { rejectWithValue }) =>
    (await resolve(saleService.getOfferCategories(offerId), rejectWithValue)).data,
)

export const loadOfferListings = createAsyncThunk<OfferListingLinkRow[], string, ThunkConfig>(
  'sale/loadOfferListings',
  async (offerId, { rejectWithValue }) =>
    (await resolve(saleService.getOfferListings(offerId), rejectWithValue)).data,
)

// ============= ENROLLMENT THUNKS (admin) =============

export const loadEventEnrollments = createAsyncThunk<SaleEnrollmentRow[], string, ThunkConfig>(
  'sale/loadEventEnrollments',
  async (eventId, { rejectWithValue }) =>
    (await resolve(saleService.getEventEnrollments(eventId), rejectWithValue))
      .data as SaleEnrollmentRow[],
)

export const updateEnrollmentStatus = createAsyncThunk<
  VendorEnrollment,
  { enrollmentId: string; status: EnrollmentDecision },
  ThunkConfig
>('sale/updateEnrollmentStatus', async ({ enrollmentId, status }, { rejectWithValue }) => {
  try {
    parseOrThrow(updateEnrollmentStatusSchema, { status })
    const { data } = await resolve(
      saleService.updateEnrollmentStatus(enrollmentId, status),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to update enrollment.')
  }
})

// ============= VENDOR THUNKS =============

export const loadActiveEvents = createAsyncThunk<SaleEventForVendor[], void, ThunkConfig>(
  'sale/loadActiveEvents',
  async (_, { rejectWithValue }) =>
    (await resolve(saleService.getActiveEvents(), rejectWithValue)).data,
)

export const joinEvent = createAsyncThunk<
  { enrollment: VendorEnrollment; requestId: string },
  { eventId: string; shopId: string },
  ThunkConfig
>('sale/joinEvent', async ({ eventId, shopId }, { requestId, rejectWithValue }) => {
  try {
    parseOrThrow(vendorEnrollSchema, { event_id: eventId, shop_id: shopId })
    const { data } = await resolve(saleService.joinEvent(eventId, shopId), rejectWithValue)
    return { enrollment: data, requestId }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to join event.')
  }
})

export const withdrawEnrollment = createAsyncThunk<string, string, ThunkConfig>(
  'sale/withdrawEnrollment',
  async (enrollmentId, { rejectWithValue }) => {
    const response = await saleService.withdrawEnrollment(enrollmentId)
    if (!response.success) return rejectWithValue(response.error ?? 'Failed to withdraw.')
    return enrollmentId
  },
)

export const loadVendorEnrollments = createAsyncThunk<SaleEnrollmentRow[], string, ThunkConfig>(
  'sale/loadVendorEnrollments',
  async (shopId, { rejectWithValue }) => {
    const { data } = await resolve(saleService.getVendorEnrollments(shopId), rejectWithValue)
    return formatEnrollments(data) as SaleEnrollmentRow[]
  },
)

export const loadEnrolledEventDiscounts = createAsyncThunk<
  EnrolledEventDiscount[],
  string,
  ThunkConfig
>('sale/loadEnrolledEventDiscounts', async (shopId, { rejectWithValue }) =>
  (await resolve(saleService.getEnrolledEventDiscounts(shopId), rejectWithValue)).data,
)

// ============= PICKER THUNKS (admin) =============

export const loadCategories = createAsyncThunk<
  SaleCategoryOption[],
  CategoryPickerParams | undefined,
  ThunkConfig
>('sale/loadCategories', async (options = {}, { rejectWithValue }) => {
  try {
    const parsed = parseOrThrow(categoryQuerySchema, {
      parent_id: options.parentId ?? null,
      search: options.search ?? null,
      status: options.status ?? 'A',
      lang_code: options.langCode ?? 'en',
    })
    const { data } = await resolve(
      saleService.getCategories({
        parentId: parsed.parent_id,
        search: parsed.search,
        status: parsed.status,
        langCode: parsed.lang_code,
      }),
      rejectWithValue,
    )
    return data
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load categories.')
  }
})

export const loadAllActiveCategories = createAsyncThunk<SaleCategoryOption[], void, ThunkConfig>(
  'sale/loadAllActiveCategories',
  async (_, { rejectWithValue }) =>
    (await resolve(saleService.getAllActiveCategories(), rejectWithValue)).data,
)

export const loadListingsForPicker = createAsyncThunk<
  { items: SaleListingOption[]; append: boolean },
  ListingPickerParams | undefined,
  ThunkConfig
>('sale/loadListingsForPicker', async (options = {}, { rejectWithValue }) => {
  try {
    const parsed = parseOrThrow(listingPickerQuerySchema, {
      shop_ids: options.shopIds ?? undefined,
      search: options.search ?? null,
      listing_type: options.listingType ?? null,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    })
    const { data } = await resolve(
      saleService.getListingsForOfferPicker({
        shopIds: parsed.shop_ids,
        search: parsed.search,
        listingType: parsed.listing_type,
        limit: parsed.limit,
        offset: parsed.offset,
      }),
      rejectWithValue,
    )
    return { items: data, append: (parsed.offset ?? 0) > 0 }
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Failed to load listings.')
  }
})

// ============= SLICE =============

const saleSlice = createSlice({
  name: 'sale',
  initialState,
  reducers: {
    setCurrentEvent(state, action: PayloadAction<SaleEventDetail | null>) {
      state.currentEvent = action.payload
    },
    clearCurrentEvent(state) {
      state.currentEvent = null
      state.offers = []
      state.offerCategories = []
      state.offerListings = []
    },
    clearMessages(state) {
      state.error = null
      state.successMessage = null
    },
    setSaleError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    clearPickerState(state) {
      state.categories = []
      state.pickerListings = []
      state.offerCategories = []
      state.offerListings = []
    },
    resetSale() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      // ---- events: load ----
      .addCase(loadEvents.pending, (state) => {
        state.isLoadingEvents = true
        state.error = null
      })
      .addCase(loadEvents.fulfilled, (state, action) => {
        state.isLoadingEvents = false
        state.events = action.payload
      })
      .addCase(loadEvents.rejected, (state, action) => {
        state.isLoadingEvents = false
        state.error = action.payload ?? 'Failed to load events.'
      })

      .addCase(loadEventById.pending, (state) => {
        state.isLoadingEvent = true
        state.error = null
      })
      .addCase(loadEventById.fulfilled, (state, action) => {
        state.isLoadingEvent = false
        state.currentEvent = action.payload
        state.offers = action.payload.event_offers ?? []
      })
      .addCase(loadEventById.rejected, (state, action) => {
        state.isLoadingEvent = false
        state.error = action.payload ?? 'Failed to load event.'
      })

      .addCase(loadEventBySlug.fulfilled, (state, action) => {
        state.currentEvent = action.payload
        state.offers = action.payload.event_offers ?? []
      })
      .addCase(loadEventBySlug.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to load event.'
      })

      // ---- events: create (optimistic prepend + swap) ----
      .addCase(createEvent.pending, (state, action) => {
        state.isSavingEvent = true
        state.error = null
        const placeholder = {
          ...(action.meta.arg as Record<string, unknown>),
          id: tempId(action.meta.requestId),
          offer_count: 0,
          enrollment_count: 0,
          accepted_count: 0,
        } as unknown as SaleEventWithCounts
        state.events.unshift(placeholder)
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.isSavingEvent = false
        state.successMessage = 'Event created successfully'
        const temp = tempId(action.meta.requestId)
        const idx = state.events.findIndex((e) => e.id === temp)
        if (idx >= 0) state.events[idx] = action.payload
        else state.events.unshift(action.payload)
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.isSavingEvent = false
        state.error = action.payload ?? 'Failed to create event.'
        const temp = tempId(action.meta.requestId)
        state.events = state.events.filter((e) => e.id !== temp)
      })

      // ---- events: update (optimistic merge + rollback) ----
      .addCase(updateEvent.pending, (state, action) => {
        state.isSavingEvent = true
        state.error = null
        stashRollback(action.meta.requestId, {
          events: state.events,
          currentEvent: state.currentEvent,
        })
        const patch = action.meta.arg.payload as Record<string, unknown>
        state.events = state.events.map((e) =>
          e.id === action.meta.arg.eventId ? { ...e, ...patch } : e,
        )
        if (state.currentEvent?.id === action.meta.arg.eventId) {
          state.currentEvent = { ...state.currentEvent, ...patch }
        }
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.isSavingEvent = false
        state.successMessage = 'Event updated successfully'
        rollbackRegistry.delete(action.meta.requestId)
        state.events = state.events.map((e) =>
          e.id === action.payload.id ? action.payload : e,
        )
        if (state.currentEvent?.id === action.payload.id) {
          state.currentEvent = { ...state.currentEvent, ...action.payload }
        }
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.isSavingEvent = false
        state.error = action.payload ?? 'Failed to update event.'
        const snap = takeRollback<{ events: SaleEventWithCounts[]; currentEvent: SaleEventDetail | null }>(
          action.meta.requestId,
        )
        if (snap) {
          state.events = snap.events
          state.currentEvent = snap.currentEvent
        }
      })

      // ---- events: delete (optimistic remove + rollback) ----
      .addCase(deleteEvent.pending, (state, action) => {
        state.isDeletingEvent = true
        state.error = null
        stashRollback(action.meta.requestId, {
          events: state.events,
          currentEvent: state.currentEvent,
        })
        state.events = state.events.filter((e) => e.id !== action.meta.arg)
        if (state.currentEvent?.id === action.meta.arg) state.currentEvent = null
      })
      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.isDeletingEvent = false
        state.successMessage = 'Event deleted successfully'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(deleteEvent.rejected, (state, action) => {
        state.isDeletingEvent = false
        state.error = action.payload ?? 'Failed to delete event.'
        const snap = takeRollback<{ events: SaleEventWithCounts[]; currentEvent: SaleEventDetail | null }>(
          action.meta.requestId,
        )
        if (snap) {
          state.events = snap.events
          state.currentEvent = snap.currentEvent
        }
      })

      // ---- offers ----
      .addCase(createOffer.pending, (state) => {
        state.isSavingOffer = true
        state.error = null
      })
      .addCase(createOffer.fulfilled, (state, action) => {
        state.isSavingOffer = false
        state.successMessage = 'Offer created successfully'
        state.offers.unshift(action.payload)
      })
      .addCase(createOffer.rejected, (state, action) => {
        state.isSavingOffer = false
        state.error = action.payload ?? 'Failed to create offer.'
      })

      .addCase(attachCategoriesToOffer.fulfilled, (state) => {
        state.successMessage = 'Categories attached'
      })
      .addCase(attachCategoriesToOffer.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to attach categories.'
      })
      .addCase(attachListingsToOffer.fulfilled, (state) => {
        state.successMessage = 'Listings attached'
      })
      .addCase(attachListingsToOffer.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to attach listings.'
      })
      .addCase(replaceOfferCategories.fulfilled, (state) => {
        state.successMessage = 'Categories saved'
      })
      .addCase(replaceOfferCategories.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to save categories.'
      })
      .addCase(replaceOfferListings.fulfilled, (state) => {
        state.successMessage = 'Products saved'
      })
      .addCase(replaceOfferListings.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to save products.'
      })
      .addCase(loadOfferCategories.fulfilled, (state, action) => {
        state.offerCategories = action.payload
      })
      .addCase(loadOfferListings.fulfilled, (state, action) => {
        state.offerListings = action.payload
      })

      // ---- enrollments: admin load ----
      .addCase(loadEventEnrollments.pending, (state) => {
        state.isLoadingEnrollments = true
        state.error = null
      })
      .addCase(loadEventEnrollments.fulfilled, (state, action) => {
        state.isLoadingEnrollments = false
        state.enrollments = action.payload
      })
      .addCase(loadEventEnrollments.rejected, (state, action) => {
        state.isLoadingEnrollments = false
        state.error = action.payload ?? 'Failed to load enrollments.'
      })

      // ---- enrollments: admin accept/reject (optimistic + rollback) ----
      .addCase(updateEnrollmentStatus.pending, (state, action) => {
        state.isUpdatingEnrollment = true
        state.error = null
        stashRollback(action.meta.requestId, state.enrollments)
        state.enrollments = state.enrollments.map((e) =>
          e.id === action.meta.arg.enrollmentId
            ? { ...e, enrollment_status: action.meta.arg.status }
            : e,
        )
      })
      .addCase(updateEnrollmentStatus.fulfilled, (state, action) => {
        state.isUpdatingEnrollment = false
        state.successMessage = `Enrollment ${action.payload.enrollment_status}`
        rollbackRegistry.delete(action.meta.requestId)
        state.enrollments = state.enrollments.map((e) =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e,
        )
      })
      .addCase(updateEnrollmentStatus.rejected, (state, action) => {
        state.isUpdatingEnrollment = false
        state.error = action.payload ?? 'Failed to update enrollment.'
        const snap = takeRollback<SaleEnrollmentRow[]>(action.meta.requestId)
        if (snap) state.enrollments = snap
      })

      // ---- vendor: active events ----
      .addCase(loadActiveEvents.pending, (state) => {
        state.isLoadingActiveEvents = true
        state.error = null
      })
      .addCase(loadActiveEvents.fulfilled, (state, action) => {
        state.isLoadingActiveEvents = false
        state.activeEvents = action.payload
      })
      .addCase(loadActiveEvents.rejected, (state, action) => {
        state.isLoadingActiveEvents = false
        state.error = action.payload ?? 'Failed to load active events.'
      })

      // ---- vendor: join (optimistic add + swap) ----
      .addCase(joinEvent.pending, (state, action) => {
        state.isEnrolling = true
        state.error = null
        const nowIso = new Date().toISOString()
        state.enrollments.unshift({
          id: tempId(action.meta.requestId),
          event_id: action.meta.arg.eventId,
          shop_id: action.meta.arg.shopId,
          enrollment_status: ENROLLMENT_STATUS.PENDING,
          enrolled_at: nowIso,
          updated_at: nowIso,
          canWithdraw: true,
          _optimistic: true,
        })
      })
      .addCase(joinEvent.fulfilled, (state, action) => {
        state.isEnrolling = false
        state.successMessage = 'Successfully enrolled in the event'
        const temp = tempId(action.payload.requestId)
        const row: SaleEnrollmentRow = {
          ...action.payload.enrollment,
          canWithdraw: action.payload.enrollment.enrollment_status === 'pending',
        }
        const idx = state.enrollments.findIndex((e) => e.id === temp)
        if (idx >= 0) state.enrollments[idx] = row
        else state.enrollments.unshift(row)
      })
      .addCase(joinEvent.rejected, (state, action) => {
        state.isEnrolling = false
        state.error = action.payload ?? 'Failed to join event.'
        const temp = tempId(action.meta.requestId)
        state.enrollments = state.enrollments.filter((e) => e.id !== temp)
      })

      // ---- vendor: withdraw (optimistic remove + rollback) ----
      .addCase(withdrawEnrollment.pending, (state, action) => {
        state.error = null
        stashRollback(action.meta.requestId, state.enrollments)
        state.enrollments = state.enrollments.filter((e) => e.id !== action.meta.arg)
      })
      .addCase(withdrawEnrollment.fulfilled, (state, action) => {
        state.successMessage = 'Enrollment withdrawn'
        rollbackRegistry.delete(action.meta.requestId)
      })
      .addCase(withdrawEnrollment.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to withdraw enrollment.'
        const snap = takeRollback<SaleEnrollmentRow[]>(action.meta.requestId)
        if (snap) state.enrollments = snap
      })

      .addCase(loadVendorEnrollments.pending, (state) => {
        state.isLoadingEnrollments = true
        state.error = null
      })
      .addCase(loadVendorEnrollments.fulfilled, (state, action) => {
        state.isLoadingEnrollments = false
        state.enrollments = action.payload
      })
      .addCase(loadVendorEnrollments.rejected, (state, action) => {
        state.isLoadingEnrollments = false
        state.error = action.payload ?? 'Failed to load your enrollments.'
      })

      // ---- vendor: event discounts ----
      .addCase(loadEnrolledEventDiscounts.pending, (state) => {
        state.isLoadingDiscounts = true
        state.error = null
      })
      .addCase(loadEnrolledEventDiscounts.fulfilled, (state, action) => {
        state.isLoadingDiscounts = false
        state.enrolledEventDiscounts = action.payload
      })
      .addCase(loadEnrolledEventDiscounts.rejected, (state, action) => {
        state.isLoadingDiscounts = false
        state.error = action.payload ?? 'Failed to load event discounts.'
      })

      // ---- pickers ----
      .addCase(loadCategories.pending, (state) => {
        state.isLoadingCategories = true
      })
      .addCase(loadCategories.fulfilled, (state, action) => {
        state.isLoadingCategories = false
        state.categories = action.payload
      })
      .addCase(loadCategories.rejected, (state, action) => {
        state.isLoadingCategories = false
        state.error = action.payload ?? 'Failed to load categories.'
      })
      .addCase(loadAllActiveCategories.pending, (state) => {
        state.isLoadingCategories = true
      })
      .addCase(loadAllActiveCategories.fulfilled, (state, action) => {
        state.isLoadingCategories = false
        state.categories = action.payload
      })
      .addCase(loadAllActiveCategories.rejected, (state, action) => {
        state.isLoadingCategories = false
        state.error = action.payload ?? 'Failed to load categories.'
      })
      .addCase(loadListingsForPicker.pending, (state) => {
        state.isLoadingListings = true
      })
      .addCase(loadListingsForPicker.fulfilled, (state, action) => {
        state.isLoadingListings = false
        state.pickerListings = action.payload.append
          ? [...state.pickerListings, ...action.payload.items]
          : action.payload.items
      })
      .addCase(loadListingsForPicker.rejected, (state, action) => {
        state.isLoadingListings = false
        state.error = action.payload ?? 'Failed to load listings.'
      })
  },
})

export const {
  setCurrentEvent,
  clearCurrentEvent,
  clearMessages,
  setSaleError,
  clearPickerState,
  resetSale,
} = saleSlice.actions

export const saleReducer = saleSlice.reducer
