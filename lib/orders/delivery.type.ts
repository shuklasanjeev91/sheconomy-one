/**
 * Types for the order-delivery domain.
 *
 * Rows come straight from the generated Supabase types; the enriched
 * `EnrichedDelivery` describes the joined shape the service returns (delivery +
 * order item + order + customer). Inputs mirror the legacy delivery/tracking
 * services, expressed with this project's typing conventions.
 */

import type { Json, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type { DeliveryMode, DeliveryStatus } from './order.constants'
import type { OrderServiceResponse, PaginationMeta } from './vendor-orders.type'

// Shared response envelope + pagination meta, re-exported so delivery code is a
// one-stop import.
export type { OrderServiceResponse, PaginationMeta }

// ============= BASE ROWS =============

export type OrderDelivery = Tables<'order_delivery'>
export type OrderDeliveryInsert = TablesInsert<'order_delivery'>
export type OrderDeliveryUpdate = TablesUpdate<'order_delivery'>

// ============= JOINED / ENRICHED SHAPES =============

export type DeliveryCustomerSummary = {
  full_name?: string | null
  email?: string | null
  phone?: string | null
}

export type DeliveryOrderSummary = {
  order_number?: string | null
  user_id?: string | null
  profiles?: DeliveryCustomerSummary | null
}

export type DeliveryOrderItemSummary = {
  id: string
  product_title?: string | null
  quantity?: number | null
  listing_id?: string | null
  vendor_id?: string | null
  orders?: DeliveryOrderSummary | null
}

/** A delivery row plus the joined order-item / order / customer data. */
export type EnrichedDelivery = OrderDelivery & {
  order_items?: DeliveryOrderItemSummary | null
  orders?: DeliveryOrderSummary | null
}

// ============= INPUTS =============

/** Create-delivery payload (mirrors the legacy `createDelivery`). */
export type CreateDeliveryInput = {
  order_id: string
  order_item_id?: string | null
  delivery_mode?: DeliveryMode | string
  /** Required by the schema — a structured address object. */
  delivery_address: Json
  delivery_instructions?: string | null
  estimated_delivery_date?: string | null
  shipped_at?: string | null
  carrier_name?: string | null
  courier_service_name?: string | null
  carrier_tracking_url?: string | null
  tracking_number?: string | null
  awb_code?: string | null
  delivery_status?: DeliveryStatus
  delivery_metadata?: Json
}

/**
 * Tracking-form payload (mirrors the legacy client `createTracking`). Validates
 * the tracking number against the courier, then creates the delivery record.
 */
export type CreateTrackingInput = {
  order_id: string
  order_item_id?: string | null
  tracking_number: string
  courier_slug: string
  delivery_mode?: DeliveryMode | string
  shipping_date?: string | null
  estimated_delivery_date?: string | null
  /** Internal shipping note (stored as `delivery_instructions`). */
  note?: string | null
  custom_tracking_url?: string | null
  delivery_address?: Json | null
  notify_customer?: boolean
}

/**
 * Extra metadata for `updateDeliveryStatus`. Fields with no native column in the
 * modern schema (current location, carrier notes, failure/return reasons, …)
 * are folded into `delivery_metadata` — nothing is lost.
 */
export type UpdateDeliveryStatusMetadata = {
  tracking_number?: string | null
  carrier_name?: string | null
  carrier_tracking_url?: string | null
  current_location?: string | null
  carrier_notes?: string | null
  delivered_to?: string | null
  delivery_notes?: string | null
  failure_reason?: string | null
  return_reason?: string | null
  exception_details?: string | null
  retry_count?: number | null
  [key: string]: unknown
}

// ============= FILTERS / PAGINATION =============

export type DeliverySortField = 'created_at' | 'updated_at' | 'estimated_delivery_date'

export type VendorDeliveryOptions = {
  page?: number
  limit?: number
  status?: DeliveryStatus | null
  sort_by?: DeliverySortField
  sort_order?: 'asc' | 'desc'
}

export type TrackableDeliveryOptions = {
  status_filter?: DeliveryStatus | null
  limit?: number
  offset?: number
  include_completed?: boolean
}

export type PaginatedDeliveries = {
  deliveries: EnrichedDelivery[]
  pagination: PaginationMeta
}

export type TrackableDeliveries = {
  deliveries: OrderDelivery[]
  pagination: { limit: number; offset: number; total: number }
}

// ============= ANALYTICS =============

export type DeliveryAnalyticsFilters = {
  date_from?: string
  date_to?: string
  vendor_id?: string
  carrier_name?: string
}

export type DeliveryAnalytics = {
  total_deliveries: number
  by_status: Record<string, number>
  by_carrier: Record<string, number>
  /** Percentage (0–100) of delivered shipments that arrived on/before estimate. */
  on_time_delivery_rate: number
  /** Average days from creation to delivery for completed shipments. */
  average_delivery_time: number
}
