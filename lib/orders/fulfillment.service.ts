/**
 * Fulfillment Service
 *
 * Advanced fulfillment & logistics management, migrated from the legacy
 * `fulfillmentService`. Results use the shared `OrderServiceResponse` envelope
 * with friendly errors; access is resolved through the shared `order.access`
 * helpers (vendors manage their shop's fulfillments, admins everything).
 *
 * Schema note: the modern `order_fulfillments` table replaces the legacy
 * picking/packing sub-states with `fulfillment_status_enum`. Legacy fields
 * without a column (tracking_url, cancellation reason, …) are folded into the
 * `fulfillment_metadata` JSONB (merged, never overwritten). `fulfillment_number`
 * is required and auto-generated when the caller omits it.
 */

import { supabase } from '~/lib/supabase'
import type { Json } from '~/lib/supabase'

import { fail, isAdminUser, ok, resolveUserId, verifyOrderItemAccess, verifyVendorShopAccess } from '~/lib/orders/order.access'
import {
  FULFILLMENT_DEFAULTS,
  FULFILLMENT_EVENT_TYPE,
  FULFILLMENT_STATUS,
  ORDER_DEFAULTS,
  type FulfillmentStatus,
} from '~/lib/orders/order.constants'
import { validateFulfillmentData } from '~/lib/orders/fulfillment.validation'
import type {
  CarrierService,
  CreateFulfillmentEventInput,
  CreateFulfillmentInput,
  EnrichedFulfillment,
  Fulfillment,
  FulfillmentAnalytics,
  FulfillmentAnalyticsFilters,
  FulfillmentEvent,
  FulfillmentEventInsert,
  FulfillmentInsert,
  FulfillmentQueryOptions,
  FulfillmentUpdate,
  CarrierServiceFilters,
  OrderServiceResponse,
  PaginatedFulfillments,
  UpdateFulfillmentStatusMetadata,
} from '~/lib/orders/fulfillment.type'

const FULFILLMENT_DETAIL_SELECT = `
  *,
  order_items ( id, product_title, quantity, order_id, orders ( order_number, user_id ) ),
  fulfillment_events ( id, event_type, event_timestamp, event_description, event_code, event_location, previous_status, new_status, source_system )
`

const VENDOR_FULFILLMENT_SELECT = `
  *,
  order_items!inner ( id, product_title, vendor_id, orders ( order_number, user_id, profiles ( full_name, email ) ) )
`

const TRACK_FULFILLMENT_SELECT = `
  *,
  order_items ( id, product_title, orders ( order_number, user_id ) ),
  fulfillment_events ( id, event_type, event_timestamp, event_description, event_location, event_code )
`

function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, total_pages: total ? Math.ceil(total / limit) : 0 }
}

function generateFulfillmentNumber(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${FULFILLMENT_DEFAULTS.NUMBER_PREFIX}-${Date.now()}-${random}`
}

/** Merge new keys into the existing `fulfillment_metadata` JSON (never overwrite the whole blob). */
function mergeMetadata(existing: Json | null | undefined, patch: Record<string, unknown>): Json {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}
  return { ...(base as Record<string, unknown>), ...patch } as Json
}

// ============= EVENTS =============

/** Append a fulfillment event (timeline entry). Reused internally on create/status-change. */
export async function createFulfillmentEvent(
  fulfillmentId: string,
  eventData: CreateFulfillmentEventInput,
): Promise<OrderServiceResponse<FulfillmentEvent>> {
  try {
    const payload: FulfillmentEventInsert = {
      fulfillment_id: fulfillmentId,
      event_type: eventData.event_type,
      event_timestamp: eventData.event_timestamp ?? new Date().toISOString(),
      event_description: eventData.event_description,
      event_code: eventData.event_code ?? null,
      event_location: eventData.event_location ?? null,
      previous_status: eventData.previous_status ?? null,
      new_status: eventData.new_status ?? null,
      source_system: eventData.source_system ?? FULFILLMENT_DEFAULTS.EVENT_SOURCE_SYSTEM,
      triggered_by: eventData.triggered_by ?? null,
      event_data: (eventData.event_data ?? {}) as Json,
    }

    const { data, error } = await supabase
      .from('fulfillment_events')
      .insert(payload)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to create fulfillment event')
    return ok(data as FulfillmentEvent)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while creating fulfillment event')
  }
}

// ============= MUTATIONS =============

/** Create a fulfillment record for an order item (vendor owner or admin). */
export async function createFulfillment(
  input: CreateFulfillmentInput,
  userId?: string | null,
): Promise<OrderServiceResponse<Fulfillment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const fulfilledBy = input.fulfilled_by ?? id
  const validation = validateFulfillmentData({ ...input, fulfilled_by: fulfilledBy })
  if (!validation.isValid) return fail(validation.errors.join(', '))

  try {
    const access = await verifyOrderItemAccess(input.order_item_id, id)
    if (!access.success) return fail(access.error)

    const payload: FulfillmentInsert = {
      order_item_id: input.order_item_id,
      fulfilled_by: fulfilledBy,
      fulfillment_number: input.fulfillment_number ?? generateFulfillmentNumber(),
      fulfillment_status: FULFILLMENT_STATUS.PENDING,
      quantity_to_fulfill: input.quantity_to_fulfill,
      priority_level: input.priority_level ?? FULFILLMENT_DEFAULTS.PRIORITY_LEVEL,
      fulfillment_center_id: input.fulfillment_center_id ?? null,
      carrier_code: input.carrier_code ?? null,
      carrier_service_code: input.carrier_service_code ?? null,
      estimated_ship_date: input.estimated_ship_date ?? null,
      estimated_delivery_date: input.estimated_delivery_date ?? null,
      delivery_instructions: input.delivery_instructions ?? null,
      internal_notes: input.internal_notes ?? null,
    }

    const { data, error } = await supabase
      .from('order_fulfillments')
      .insert(payload)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to create fulfillment record')

    await createFulfillmentEvent(data.id, {
      event_type: FULFILLMENT_EVENT_TYPE.STATUS_CHANGE,
      previous_status: null,
      new_status: FULFILLMENT_STATUS.PENDING,
      event_description: 'Fulfillment created',
      triggered_by: fulfilledBy,
    })

    return ok(data as Fulfillment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while creating fulfillment record')
  }
}

/** Update a fulfillment's status, applying status-specific fields + logging an event. */
export async function updateFulfillmentStatus(
  fulfillmentId: string,
  status: FulfillmentStatus,
  metadata: UpdateFulfillmentStatusMetadata = {},
  userId?: string | null,
): Promise<OrderServiceResponse<Fulfillment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  if (!fulfillmentId || !status) return fail('Fulfillment ID and status are required')
  if (!(Object.values(FULFILLMENT_STATUS) as string[]).includes(status)) {
    return fail('Invalid fulfillment status')
  }

  try {
    const { data: current } = await supabase
      .from('order_fulfillments')
      .select('fulfillment_status, fulfillment_metadata, order_item_id')
      .eq('id', fulfillmentId)
      .single()

    if (!current) return fail('Fulfillment not found')

    const access = await verifyOrderItemAccess(current.order_item_id, id)
    if (!access.success) return fail(access.error)

    const now = new Date().toISOString()
    const updates: FulfillmentUpdate = { fulfillment_status: status, updated_at: now }
    const metaPatch: Record<string, unknown> = {}

    switch (status) {
      case FULFILLMENT_STATUS.READY_TO_SHIP:
        if (metadata.shipping_label_url) updates.shipping_label_url = metadata.shipping_label_url
        break
      case FULFILLMENT_STATUS.SHIPPED:
        updates.shipped_at = now
        if (metadata.tracking_number) updates.tracking_number = metadata.tracking_number
        if (metadata.quantity_shipped != null) updates.quantity_shipped = metadata.quantity_shipped
        if (metadata.shipping_cost != null) updates.shipping_cost = metadata.shipping_cost
        if (metadata.insurance_cost != null) updates.insurance_cost = metadata.insurance_cost
        if (metadata.package_weight_grams != null) updates.package_weight_grams = metadata.package_weight_grams
        if (metadata.package_dimensions_cm) updates.package_dimensions_cm = metadata.package_dimensions_cm
        if (metadata.tracking_url) metaPatch.tracking_url = metadata.tracking_url
        break
      case FULFILLMENT_STATUS.DELIVERED:
        updates.delivered_at = now
        if (metadata.quantity_delivered != null) updates.quantity_delivered = metadata.quantity_delivered
        break
      case FULFILLMENT_STATUS.DELIVERY_FAILED:
      case FULFILLMENT_STATUS.EXCEPTION:
        updates.last_failure_at = now
        if (metadata.exception_reason) updates.last_failure_reason = metadata.exception_reason
        if (metadata.next_retry_at) updates.next_retry_at = metadata.next_retry_at
        break
      case FULFILLMENT_STATUS.RETURNED:
      case FULFILLMENT_STATUS.RETURNED_TO_SENDER:
        updates.returned_at = now
        if (metadata.return_reason) updates.return_reason = metadata.return_reason
        if (metadata.quantity_returned != null) updates.quantity_returned = metadata.quantity_returned
        break
      case FULFILLMENT_STATUS.CANCELLED:
        if (metadata.cancellation_reason) metaPatch.cancellation_reason = metadata.cancellation_reason
        break
      default:
        break
    }

    if (Object.keys(metaPatch).length > 0) {
      updates.fulfillment_metadata = mergeMetadata(current.fulfillment_metadata, metaPatch)
    }

    const { data, error } = await supabase
      .from('order_fulfillments')
      .update(updates)
      .eq('id', fulfillmentId)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to update fulfillment status')

    await createFulfillmentEvent(fulfillmentId, {
      event_type: FULFILLMENT_EVENT_TYPE.STATUS_CHANGE,
      previous_status: current.fulfillment_status,
      new_status: status,
      event_description: `Status updated to ${status}`,
      triggered_by: metadata.updated_by ?? id,
      source_system: metadata.source_system,
      event_data: metadata,
    })

    return ok(data as Fulfillment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while updating fulfillment status')
  }
}

// ============= READS =============

/** Full detail for a single fulfillment, including its event timeline. */
export async function getFulfillmentDetails(
  fulfillmentId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedFulfillment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!fulfillmentId) return fail('Fulfillment ID is required')

  try {
    const { data, error } = await supabase
      .from('order_fulfillments')
      .select(FULFILLMENT_DETAIL_SELECT)
      .eq('id', fulfillmentId)
      .single()

    if (error) return fail(error, 'Failed to fetch fulfillment details')
    return ok(data as unknown as EnrichedFulfillment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching fulfillment details')
  }
}

/** Fulfillments for a vendor shop's items (owner or admin). */
export async function getVendorFulfillments(
  vendorId: string,
  options: FulfillmentQueryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedFulfillments>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!vendorId) return fail('Vendor ID is required')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const page = options.page ?? ORDER_DEFAULTS.PAGE
    const limit = options.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'

    let query = supabase
      .from('order_fulfillments')
      .select(VENDOR_FULFILLMENT_SELECT, { count: 'exact' })
      .eq('order_items.vendor_id', vendorId)

    if (options.status) query = query.eq('fulfillment_status', options.status as FulfillmentStatus)
    if (options.carrier_code) query = query.eq('carrier_code', options.carrier_code)
    if (options.fulfillment_center_id) query = query.eq('fulfillment_center_id', options.fulfillment_center_id)
    if (options.priority_level != null) query = query.eq('priority_level', options.priority_level)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch vendor fulfillments')

    return ok({
      fulfillments: (data as unknown as EnrichedFulfillment[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching vendor fulfillments')
  }
}

/** All fulfillments across the platform (admin only). */
export async function getAllFulfillmentsForAdmin(
  options: FulfillmentQueryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedFulfillments>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

  try {
    const page = options.page ?? ORDER_DEFAULTS.PAGE
    const limit = options.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'

    let query = supabase
      .from('order_fulfillments')
      .select(FULFILLMENT_DETAIL_SELECT, { count: 'exact' })

    if (options.status) query = query.eq('fulfillment_status', options.status as FulfillmentStatus)
    if (options.carrier_code) query = query.eq('carrier_code', options.carrier_code)
    if (options.fulfillment_center_id) query = query.eq('fulfillment_center_id', options.fulfillment_center_id)
    if (options.priority_level != null) query = query.eq('priority_level', options.priority_level)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch fulfillments')

    return ok({
      fulfillments: (data as unknown as EnrichedFulfillment[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching fulfillments')
  }
}

/** Look up a fulfillment by its carrier tracking number. */
export async function trackFulfillment(
  trackingNumber: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedFulfillment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!trackingNumber) return fail('Tracking number is required')

  try {
    const { data, error } = await supabase
      .from('order_fulfillments')
      .select(TRACK_FULFILLMENT_SELECT)
      .eq('tracking_number', trackingNumber)
      .single()

    if (error) return fail(error, 'Tracking number not found')
    return ok(data as unknown as EnrichedFulfillment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while tracking fulfillment')
  }
}

/** Active carrier services, optionally filtered by international coverage. */
export async function getCarrierServices(
  filters: CarrierServiceFilters = {},
  userId?: string | null,
): Promise<OrderServiceResponse<CarrierService[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    let query = supabase
      .from('carrier_services')
      .select('*')
      .eq('is_active', filters.is_active ?? true)
      .order('carrier_code', { ascending: true })

    if (filters.is_international != null) query = query.eq('is_international', filters.is_international)

    const { data, error } = await query
    if (error) return fail(error, 'Failed to fetch carrier services')
    return ok((data as CarrierService[]) ?? [])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching carrier services')
  }
}

// ============= ANALYTICS =============

/**
 * Fulfillment analytics: totals, per-status/carrier breakdowns, on-time
 * shipment/delivery rates and average fulfillment time. Vendor-scoped when
 * `vendor_id` is supplied (owner or admin), otherwise admin-gated.
 */
export async function getFulfillmentAnalytics(
  filters: FulfillmentAnalyticsFilters = {},
  userId?: string | null,
): Promise<OrderServiceResponse<FulfillmentAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    if (filters.vendor_id) {
      const access = await verifyVendorShopAccess(filters.vendor_id, id)
      if (!access.success) return fail(access.error)
    } else if (!(await isAdminUser(id))) {
      return fail('Access denied for admin operations')
    }

    const select = filters.vendor_id
      ? `fulfillment_status, carrier_code, created_at, shipped_at, delivered_at, estimated_ship_date, estimated_delivery_date, order_items!inner ( vendor_id )`
      : `fulfillment_status, carrier_code, created_at, shipped_at, delivered_at, estimated_ship_date, estimated_delivery_date`

    let query = supabase.from('order_fulfillments').select(select)

    if (filters.date_from) query = query.gte('created_at', filters.date_from)
    if (filters.date_to) query = query.lte('created_at', filters.date_to)
    if (filters.vendor_id) query = query.eq('order_items.vendor_id', filters.vendor_id)
    if (filters.fulfillment_center_id) query = query.eq('fulfillment_center_id', filters.fulfillment_center_id)

    const { data, error } = await query
    if (error) return fail(error, 'Failed to fetch fulfillment analytics')

    const rows = (data ?? []) as unknown as {
      fulfillment_status: string | null
      carrier_code: string | null
      created_at: string
      shipped_at: string | null
      delivered_at: string | null
      estimated_ship_date: string | null
      estimated_delivery_date: string | null
    }[]

    const byStatus: Record<string, number> = {}
    const byCarrier: Record<string, number> = {}
    let onTimeShipments = 0
    let onTimeDeliveries = 0
    let totalFulfillmentDays = 0
    let completedFulfillments = 0

    for (const f of rows) {
      if (f.fulfillment_status) byStatus[f.fulfillment_status] = (byStatus[f.fulfillment_status] ?? 0) + 1
      if (f.carrier_code) byCarrier[f.carrier_code] = (byCarrier[f.carrier_code] ?? 0) + 1

      if (f.shipped_at && f.estimated_ship_date) {
        if (new Date(f.shipped_at) <= new Date(f.estimated_ship_date)) onTimeShipments += 1
      }
      if (f.delivered_at && f.estimated_delivery_date) {
        if (new Date(f.delivered_at) <= new Date(f.estimated_delivery_date)) onTimeDeliveries += 1
        totalFulfillmentDays +=
          (new Date(f.delivered_at).getTime() - new Date(f.created_at).getTime()) / (1000 * 60 * 60 * 24)
        completedFulfillments += 1
      }
    }

    const shippedCount = byStatus[FULFILLMENT_STATUS.SHIPPED] ?? 0
    const deliveredCount = byStatus[FULFILLMENT_STATUS.DELIVERED] ?? 0

    return ok({
      total_fulfillments: rows.length,
      by_status: byStatus,
      by_carrier: byCarrier,
      on_time_shipment_rate: shippedCount > 0 ? (onTimeShipments / shippedCount) * 100 : 0,
      on_time_delivery_rate: deliveredCount > 0 ? (onTimeDeliveries / deliveredCount) * 100 : 0,
      average_fulfillment_time: completedFulfillments > 0 ? totalFulfillmentDays / completedFulfillments : 0,
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while calculating fulfillment analytics')
  }
}
