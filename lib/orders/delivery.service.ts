/**
 * Delivery Service
 *
 * Delivery tracking + management for orders, migrated from the legacy
 * `deliveryService` and the local part of the client `trackingService`. Results
 * come back in the shared `OrderServiceResponse` envelope with friendly errors;
 * access is resolved through the shared `order.access` helpers.
 *
 * Notes / deferrals:
 *  - The external AfterShip `/api/tracking` integration (create/list/get/update
 *    against the carrier API) is **not** migrated — there is no such route in
 *    this project yet. The local pieces (tracking-number validation + creating
 *    the `order_delivery` record) are migrated as `createTracking`.
 *  - The modern `order_delivery` schema has no bespoke columns for
 *    `current_location`, `carrier_notes`, `delivered_to`, `failure_reason`, …;
 *    those are folded into the `delivery_metadata` JSON blob (merged, never
 *    clobbered) so nothing is lost.
 *  - Cross-status sync is owned by the DB: inserting/updating an `order_delivery`
 *    row fires `sync_order_item_status_from_delivery`, which moves the parent
 *    order item(s) to the mapped status automatically.
 */

import { supabase, type Json } from '~/lib/supabase'

import {
  fail,
  isAdminUser,
  ok,
  resolveUserId,
  verifyOrderItemAccess,
  verifyVendorShopAccess,
} from '~/lib/orders/order.access'
import { DELIVERY_STATUS, type DeliveryStatus } from '~/lib/orders/order.constants'
import { getCourierName, validateDeliveryData, validateWithSuggestions } from '~/lib/orders/tracking.validation'
import type {
  CreateDeliveryInput,
  CreateTrackingInput,
  DeliveryAnalytics,
  DeliveryAnalyticsFilters,
  EnrichedDelivery,
  OrderDelivery,
  OrderDeliveryInsert,
  OrderDeliveryUpdate,
  OrderServiceResponse,
  PaginatedDeliveries,
  TrackableDeliveries,
  TrackableDeliveryOptions,
  UpdateDeliveryStatusMetadata,
  VendorDeliveryOptions,
} from '~/lib/orders/delivery.type'

const DEFAULT_DELIVERY_MODE = 'standard'

const VENDOR_DELIVERY_SELECT = `
  *,
  order_items!inner (
    id,
    product_title,
    quantity,
    vendor_id,
    orders (
      order_number,
      user_id,
      profiles ( full_name, email )
    )
  )
`

function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, total_pages: total ? Math.ceil(total / limit) : 0 }
}

/** Merge extra keys into an existing `delivery_metadata` object without clobbering it. */
function mergeMetadata(
  existing: OrderDelivery['delivery_metadata'] | null | undefined,
  extra: Record<string, unknown>,
): Json {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  const cleaned = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined))
  return { ...base, ...cleaned } as unknown as Json
}

// ============= MUTATIONS =============

/**
 * Create a delivery record for an order item. Defaults the status to `shipped`
 * (as the legacy service did); the DB trigger then advances the order item.
 */
export async function createDelivery(
  input: CreateDeliveryInput,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderDelivery>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const validation = validateDeliveryData(input)
  if (!validation.isValid) return fail(validation.errors.join(', '))

  try {
    // Prefer item-level access when we have the item id; RLS is the real gate.
    if (input.order_item_id) {
      const access = await verifyOrderItemAccess(input.order_item_id, id)
      if (!access.success) return fail(access.error ?? 'Access denied to this order item')
    }

    const payload: OrderDeliveryInsert = {
      order_id: input.order_id,
      order_item_id: input.order_item_id ?? null,
      delivery_status: input.delivery_status ?? DELIVERY_STATUS.SHIPPED,
      delivery_mode: input.delivery_mode ?? DEFAULT_DELIVERY_MODE,
      delivery_address: input.delivery_address,
      delivery_instructions: input.delivery_instructions ?? null,
      estimated_delivery_date: input.estimated_delivery_date ?? null,
      shipped_at: input.shipped_at ?? new Date().toISOString(),
      carrier_name: input.carrier_name ?? null,
      courier_service_name: input.courier_service_name ?? null,
      carrier_tracking_url: input.carrier_tracking_url ?? null,
      tracking_number: input.tracking_number ?? null,
      awb_code: input.awb_code ?? null,
      delivery_metadata: input.delivery_metadata ?? {},
    }

    const { data, error } = await supabase.from('order_delivery').insert(payload).select('*').single()
    if (error) return fail(error, 'Failed to create delivery record')

    // Kick an immediate track sync (cron continues for later milestones).
    if (data?.id && data.tracking_number) {
      void supabase.functions
        .invoke('courier-track-sync', { body: { delivery_id: data.id } })
        .catch(() => undefined)
    }

    return ok(data as OrderDelivery)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while creating delivery record')
  }
}

/**
 * Validate a tracking number against its courier and create the delivery record
 * (mirrors the legacy client `createTracking`, minus the AfterShip call).
 */
export async function createTracking(
  input: CreateTrackingInput,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderDelivery>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!input.order_id) return fail('Order ID is required for tracking creation')

  const validation = validateWithSuggestions(input.tracking_number, input.courier_slug)
  if (!validation.isValid) {
    const detail = validation.suggestions?.length ? ` ${validation.suggestions[0]}` : ''
    return fail(`${validation.message}.${detail}`.trim())
  }

  const deliveryInput: CreateDeliveryInput = {
    order_id: input.order_id,
    order_item_id: input.order_item_id ?? null,
    delivery_mode: input.delivery_mode ?? DEFAULT_DELIVERY_MODE,
    delivery_address: input.delivery_address ?? {},
    delivery_instructions: input.note ?? null,
    estimated_delivery_date: input.estimated_delivery_date ?? null,
    shipped_at: input.shipping_date ?? new Date().toISOString(),
    carrier_name: getCourierName(input.courier_slug),
    courier_service_name: getCourierName(input.courier_slug),
    carrier_tracking_url: input.custom_tracking_url ?? null,
    tracking_number: input.tracking_number,
    delivery_status: DELIVERY_STATUS.SHIPPED,
    delivery_metadata: {
      courier_slug: input.courier_slug,
      notify_customer: input.notify_customer ?? true,
    } as unknown as Json,
  }

  return createDelivery(deliveryInput, id)
}

/** Update a delivery's status, attaching status-specific timestamps/metadata. */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  metadata: UpdateDeliveryStatusMetadata = {},
  userId?: string | null,
): Promise<OrderServiceResponse<OrderDelivery>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!deliveryId || !status) return fail('Delivery ID and status are required')
  if (!(Object.values(DELIVERY_STATUS) as string[]).includes(status)) {
    return fail('Invalid delivery status')
  }

  try {
    const { data: existing } = await supabase
      .from('order_delivery')
      .select('*')
      .eq('id', deliveryId)
      .maybeSingle()
    if (!existing) return fail('Delivery record not found')

    const now = new Date().toISOString()
    const updates: OrderDeliveryUpdate = { delivery_status: status, updated_at: now }

    switch (status) {
      case DELIVERY_STATUS.SHIPPED:
      case DELIVERY_STATUS.IN_TRANSIT:
        updates.shipped_at = (existing as OrderDelivery).shipped_at ?? now
        break
      case DELIVERY_STATUS.DELIVERED:
        updates.delivered_at = now
        updates.actual_delivery_date = now.split('T')[0]
        break
      default:
        break
    }

    // Native columns when provided.
    if (metadata.tracking_number != null) updates.tracking_number = metadata.tracking_number
    if (metadata.carrier_name != null) updates.carrier_name = metadata.carrier_name
    if (metadata.carrier_tracking_url != null) updates.carrier_tracking_url = metadata.carrier_tracking_url

    // Everything without a native column is folded into delivery_metadata.
    const metaExtras: Record<string, unknown> = {
      current_location: metadata.current_location ?? undefined,
      carrier_notes: metadata.carrier_notes ?? undefined,
      delivered_to: metadata.delivered_to ?? undefined,
      delivery_notes: metadata.delivery_notes ?? undefined,
      failure_reason: metadata.failure_reason ?? undefined,
      return_reason: metadata.return_reason ?? undefined,
      exception_details: metadata.exception_details ?? undefined,
      retry_count: metadata.retry_count ?? undefined,
    }
    if (Object.values(metaExtras).some((value) => value !== undefined)) {
      updates.delivery_metadata = mergeMetadata((existing as OrderDelivery).delivery_metadata, metaExtras)
    }

    const { data, error } = await supabase
      .from('order_delivery')
      .update(updates)
      .eq('id', deliveryId)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to update delivery status')
    return ok(data as OrderDelivery)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while updating delivery status')
  }
}

// ============= READS =============

/** Delivery records for a single order item, newest first. */
export async function getOrderDeliveries(
  orderItemId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedDelivery[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!orderItemId) return fail('Order item ID is required')

  try {
    const { data, error } = await supabase
      .from('order_delivery')
      .select('*, order_items ( id, product_title, quantity, listing_id )')
      .eq('order_item_id', orderItemId)
      .order('created_at', { ascending: false })

    if (error) return fail(error, 'Failed to fetch delivery details')
    return ok((data as unknown as EnrichedDelivery[]) ?? [])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching delivery details')
  }
}

/** Delivery records for a whole order, newest first. */
export async function getDeliveriesByOrder(
  orderId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedDelivery[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!orderId) return fail('Order ID is required')

  try {
    const { data, error } = await supabase
      .from('order_delivery')
      .select('*, order_items ( id, product_title, quantity, listing_id, vendor_id )')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (error) return fail(error, 'Failed to fetch delivery details')
    return ok((data as unknown as EnrichedDelivery[]) ?? [])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching delivery details')
  }
}

/** Look up a single delivery by its tracking number. */
export async function trackDelivery(
  trackingNumber: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedDelivery>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!trackingNumber) return fail('Tracking number is required')

  try {
    const { data, error } = await supabase
      .from('order_delivery')
      .select(`*, orders ( order_number, user_id ), order_items ( id, product_title, quantity )`)
      .eq('tracking_number', trackingNumber)
      .maybeSingle()

    if (error) return fail(error, 'Tracking number not found')
    if (!data) return fail('Tracking number not found')
    return ok(data as unknown as EnrichedDelivery)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while tracking delivery')
  }
}

/** Paginated deliveries for a vendor shop (owner or admin). */
export async function getVendorDeliveries(
  vendorId: string,
  options: VendorDeliveryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedDeliveries>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!vendorId) return fail('A shop is required.')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const page = options.page ?? 1
    const limit = options.limit ?? 20
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'
    const offset = (page - 1) * limit

    let query = supabase
      .from('order_delivery')
      .select(VENDOR_DELIVERY_SELECT, { count: 'exact' })
      .eq('order_items.vendor_id', vendorId)

    if (options.status) query = query.eq('delivery_status', options.status)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch vendor deliveries')

    return ok({
      deliveries: (data as unknown as EnrichedDelivery[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching vendor deliveries')
  }
}

/**
 * Deliveries with a tracking number that are still "in flight". Admin only
 * (used by tracking-sync tooling).
 */
export async function getTrackableDeliveries(
  options: TrackableDeliveryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<TrackableDeliveries>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

  try {
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    let query = supabase
      .from('order_delivery')
      .select('*', { count: 'exact' })
      .not('tracking_number', 'is', null)
      .neq('tracking_number', '')

    if (!options.include_completed) {
      query = query.not(
        'delivery_status',
        'in',
        `(${[DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.CANCELLED, DELIVERY_STATUS.RETURNED_TO_SENDER]
          .map((status) => `"${status}"`)
          .join(',')})`,
      )
    }
    if (options.status_filter) query = query.eq('delivery_status', options.status_filter)

    const { data, error, count } = await query
      .order('updated_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch trackable deliveries')

    return ok({
      deliveries: (data as OrderDelivery[]) ?? [],
      pagination: { limit, offset, total: count ?? data?.length ?? 0 },
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching trackable deliveries')
  }
}

// ============= ANALYTICS =============

/**
 * Delivery analytics. Vendor-scoped when `filters.vendor_id` is set (owner or
 * admin); otherwise admin-only (platform-wide).
 */
export async function getDeliveryAnalytics(
  filters: DeliveryAnalyticsFilters = {},
  userId?: string | null,
): Promise<OrderServiceResponse<DeliveryAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  if (filters.vendor_id) {
    const access = await verifyVendorShopAccess(filters.vendor_id, id)
    if (!access.success) return fail(access.error)
  } else if (!(await isAdminUser(id))) {
    return fail('Access denied for admin operations')
  }

  try {
    let query = supabase
      .from('order_delivery')
      .select(
        'delivery_status, carrier_name, created_at, delivered_at, estimated_delivery_date, order_items!inner ( vendor_id )',
      )

    if (filters.date_from) query = query.gte('created_at', filters.date_from)
    if (filters.date_to) query = query.lte('created_at', filters.date_to)
    if (filters.vendor_id) query = query.eq('order_items.vendor_id', filters.vendor_id)
    if (filters.carrier_name) query = query.eq('carrier_name', filters.carrier_name)

    const { data, error } = await query
    if (error) return fail(error, 'Failed to fetch delivery analytics')

    const rows = (data ?? []) as Array<{
      delivery_status: string | null
      carrier_name: string | null
      created_at: string | null
      delivered_at: string | null
      estimated_delivery_date: string | null
    }>

    const byStatus: Record<string, number> = {}
    const byCarrier: Record<string, number> = {}
    let onTime = 0
    let totalDeliveryDays = 0
    let completed = 0

    for (const delivery of rows) {
      if (delivery.delivery_status) {
        byStatus[delivery.delivery_status] = (byStatus[delivery.delivery_status] ?? 0) + 1
      }
      if (delivery.carrier_name) {
        byCarrier[delivery.carrier_name] = (byCarrier[delivery.carrier_name] ?? 0) + 1
      }
      if (delivery.delivered_at && delivery.estimated_delivery_date) {
        const delivered = new Date(delivery.delivered_at)
        const estimated = new Date(delivery.estimated_delivery_date)
        if (delivered <= estimated) onTime += 1
        if (delivery.created_at) {
          const created = new Date(delivery.created_at)
          totalDeliveryDays += (delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
          completed += 1
        }
      }
    }

    const deliveredCount = byStatus[DELIVERY_STATUS.DELIVERED] ?? 0

    return ok({
      total_deliveries: rows.length,
      by_status: byStatus,
      by_carrier: byCarrier,
      on_time_delivery_rate: deliveredCount > 0 ? (onTime / deliveredCount) * 100 : 0,
      average_delivery_time: completed > 0 ? totalDeliveryDays / completed : 0,
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while calculating delivery analytics')
  }
}
