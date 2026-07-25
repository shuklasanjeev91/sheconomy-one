/**
 * Types for the fulfillment / logistics domain.
 *
 * Rows come from the generated Supabase types. The modern `order_fulfillments`
 * table differs from the legacy one: `fulfillment_number` is required,
 * `priority_level` is numeric, `package_weight`→`package_weight_grams`,
 * `package_dimensions`→`package_dimensions_cm`, `service_code`→
 * `carrier_service_code`; fields without a column (tracking_url, cancellation
 * reason, legacy picking/packing timestamps) are folded into
 * `fulfillment_metadata` (see the service + doc).
 */

import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type { FulfillmentEventType, FulfillmentStatus } from '~/lib/orders/order.constants'
import type { OrderServiceResponse } from '~/lib/orders/vendor-orders.type'

export type { OrderServiceResponse }

// ============= BASE ROWS =============

export type Fulfillment = Tables<'order_fulfillments'>
export type FulfillmentInsert = TablesInsert<'order_fulfillments'>
export type FulfillmentUpdate = TablesUpdate<'order_fulfillments'>
export type FulfillmentEvent = Tables<'fulfillment_events'>
export type FulfillmentEventInsert = TablesInsert<'fulfillment_events'>
export type CarrierService = Tables<'carrier_services'>

// ============= JOINED / ENRICHED =============

export type FulfillmentOrderSummary = {
  order_number?: string | null
  user_id?: string | null
  profiles?: { full_name?: string | null; email?: string | null } | null
}

export type FulfillmentOrderItemSummary = {
  id: string
  product_title?: string | null
  quantity?: number | null
  order_id?: string | null
  vendor_id?: string | null
  orders?: FulfillmentOrderSummary | null
}

/** A fulfillment row enriched with the joins the service selects. */
export type EnrichedFulfillment = Fulfillment & {
  order_items?: FulfillmentOrderItemSummary | null
  fulfillment_events?: FulfillmentEvent[] | null
}

// ============= INPUTS =============

export type CreateFulfillmentInput = {
  order_item_id: string
  fulfilled_by?: string | null
  quantity_to_fulfill: number
  priority_level?: number
  fulfillment_center_id?: string | null
  carrier_code?: string | null
  carrier_service_code?: string | null
  estimated_ship_date?: string | null
  estimated_delivery_date?: string | null
  delivery_instructions?: string | null
  internal_notes?: string | null
  /** Optional; auto-generated when omitted. */
  fulfillment_number?: string
}

/** Extra fields applied per target status + used to build the status-change event. */
export type UpdateFulfillmentStatusMetadata = {
  quantity_fulfilled?: number
  quantity_shipped?: number
  quantity_delivered?: number
  quantity_returned?: number
  package_weight_grams?: number
  package_dimensions_cm?: string
  shipping_label_url?: string
  tracking_number?: string
  tracking_url?: string
  shipping_cost?: number
  insurance_cost?: number
  exception_reason?: string
  next_retry_at?: string
  cancellation_reason?: string
  return_reason?: string
  updated_by?: string | null
  source_system?: string
  [key: string]: unknown
}

export type CreateFulfillmentEventInput = {
  event_type: FulfillmentEventType | string
  event_timestamp?: string
  event_description: string
  event_code?: string | null
  event_location?: string | null
  previous_status?: FulfillmentStatus | null
  new_status?: FulfillmentStatus | null
  source_system?: string
  triggered_by?: string | null
  event_data?: Record<string, unknown>
}

// ============= FILTERS / PAGINATION =============

export type FulfillmentFilters = {
  status?: FulfillmentStatus | string | null
  priority_level?: number | null
  carrier_code?: string | null
  fulfillment_center_id?: string | null
}

export type FulfillmentQueryOptions = FulfillmentFilters & {
  page?: number
  limit?: number
  sort_by?: 'created_at' | 'updated_at' | 'priority_level' | 'estimated_ship_date'
  sort_order?: 'asc' | 'desc'
}

export type CarrierServiceFilters = {
  is_active?: boolean
  is_international?: boolean | null
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  total_pages: number
}

export type PaginatedFulfillments = {
  fulfillments: EnrichedFulfillment[]
  pagination: PaginationMeta
}

// ============= ANALYTICS =============

export type FulfillmentAnalyticsFilters = {
  date_from?: string
  date_to?: string
  vendor_id?: string
  fulfillment_center_id?: string
}

export type FulfillmentAnalytics = {
  total_fulfillments: number
  by_status: Record<string, number>
  by_carrier: Record<string, number>
  /** Percentage (0–100) shipped on or before the estimated ship date. */
  on_time_shipment_rate: number
  /** Percentage (0–100) delivered on or before the estimated delivery date. */
  on_time_delivery_rate: number
  /** Average created→delivered time in days. */
  average_fulfillment_time: number
}

/** Client-side counts over the loaded fulfillments. */
export type FulfillmentStats = {
  total: number
  pending: number
  shipped: number
  delivered: number
  cancelled: number
  overdue: number
}
