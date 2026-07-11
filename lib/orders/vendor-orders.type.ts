/**
 * Types for the vendor orders domain.
 *
 * Rows come straight from the generated Supabase types; the enriched
 * `VendorOrderItem` describes the joined shape the service returns (order +
 * listing + delivery + derived address/image conveniences).
 */

import type { Tables, TablesUpdate } from '~/lib/supabase'

import type { DeliveryStatus, OrderStatus } from './order.constants'

// ============= BASE ROWS =============

export type OrderItem = Tables<'order_items'>
export type Order = Tables<'orders'>
export type OrderStatusLog = Tables<'order_status_logs'>
export type OrderItemUpdate = TablesUpdate<'order_items'>

/** Generic service response — same envelope used across the app. */
export type OrderServiceResponse<T> = {
  data: T | null
  error: string | null
  success: boolean
}

// ============= JOINED / ENRICHED SHAPES =============

/** Address fields joined from `addresses` (billing) — a subset. */
export type OrderAddressSummary = {
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postal_code?: string | null
  address_label?: string | null
}

export type OrderCustomerSummary = {
  full_name?: string | null
  phone?: string | null
  email?: string | null
}

export type OrderListingImage = {
  id: string
  image_url: string
  is_primary: boolean | null
  display_order: number | null
}

export type OrderListingSummary = {
  id: string
  title: string
  description?: string | null
  listing_type?: string | null
  listing_images?: OrderListingImage[] | null
  /** Derived by the service for convenience. */
  main_image_url?: string | null
}

export type OrderDeliverySummary = {
  tracking_number?: string | null
  delivery_address?: unknown
  delivery_status?: DeliveryStatus | null
  estimated_delivery_date?: string | null
}

/** The parent order fields joined onto an order item. */
export type VendorOrderParent = Pick<
  Order,
  | 'id'
  | 'order_number'
  | 'order_status'
  | 'subtotal_amount'
  | 'shipping_amount'
  | 'tax_amount'
  | 'discount_amount'
  | 'total_amount'
  | 'currency'
  | 'customer_currency'
  | 'customer_country'
  | 'customer_notes'
  | 'created_at'
  | 'updated_at'
> & {
  billing_address?: OrderAddressSummary | null
  shipping_address?: OrderAddressSummary | null
  profiles?: OrderCustomerSummary | null
}

/**
 * An order item as returned to the vendor UI: the base row plus the joined
 * order/listing/delivery data and a couple of derived convenience fields.
 */
export type VendorOrderItem = OrderItem & {
  orders?: VendorOrderParent | null
  listings?: OrderListingSummary | null
  /** Singular alias kept for components that expect `item.listing`. */
  listing?: OrderListingSummary | null
  order_delivery?: OrderDeliverySummary[] | OrderDeliverySummary | null
  order_status_logs?: OrderStatusLog[] | null
  /** Derived: from `order_delivery[].delivery_address`. */
  shipping_address?: unknown
  /** Derived: from `orders.billing_address`. */
  billing_address?: OrderAddressSummary | null
}

// ============= FILTERS / PAGINATION =============

export type VendorOrderSortField = 'created_at' | 'updated_at' | 'total_price' | 'quantity'

export type VendorOrderFilters = {
  status?: OrderStatus | null
  order_number?: string | null
  date_from?: string | null
  date_to?: string | null
}

export type VendorOrderPagination = {
  page?: number
  limit?: number
  order_by?: VendorOrderSortField
  order_direction?: 'asc' | 'desc'
}

export type VendorOrderSearchParams = VendorOrderPagination & {
  query?: string
  customer_email?: string
  order_number?: string
  product_name?: string
  status?: OrderStatus
  date_from?: string
  date_to?: string
  min_amount?: number
  max_amount?: number
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  total_pages: number
}

export type PaginatedVendorOrders = {
  items: VendorOrderItem[]
  pagination: PaginationMeta
}

// ============= ANALYTICS / SUMMARY =============

export type DateRange = { from: string; to: string }

export type VendorOrderAnalytics = {
  total_orders: number
  total_revenue: number
  total_items: number
  average_order_value: number
  status_distribution: Record<string, number>
  period: DateRange
}

export type VendorTopProduct = {
  id: string
  title: string
  quantity_sold: number
  revenue: number
}

export type VendorRecentOrder = {
  order_id: string
  order_number: string | null
  customer_name: string | null
  amount: number
  status: OrderStatus | null
  created_at: string | null
}

export type VendorOrderSummary = {
  summary: {
    total_orders: number
    total_revenue: number
    total_items: number
    average_order_value: number
  }
  status_distribution: {
    orders: Record<string, number>
    items: Record<string, number>
  }
  top_products: VendorTopProduct[]
  recent_orders: VendorRecentOrder[]
  period: DateRange
}

/** Client-side counts derived from the currently loaded orders. */
export type VendorOrderStats = {
  total: number
  pending: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
}

// ============= UPDATE PAYLOADS =============

export type VendorItemStatusUpdate = {
  orderItemId: string
  newStatus: OrderStatus
  note?: string | null
}

export type VendorBulkStatusUpdate = {
  orderItemIds: string[]
  newStatus: OrderStatus
  note?: string | null
}

export type VendorItemFieldsUpdate = {
  orderItemId: string
  updates: {
    item_status?: OrderStatus
    digital_download_url?: string | null
    download_expires_at?: string | null
  }
}
