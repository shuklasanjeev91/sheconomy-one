/**
 * Customer (buyer) order detail queries and post-purchase actions.
 * Uses RLS-backed tables; every fetch is scoped to the authenticated buyer.
 */

import {
  evaluateReorderCandidates as evaluateReorderCandidatesPure,
  getCustomerOrderActionEligibility,
  PENDING_ORDER_SUCCESS_KEY,
  parsePendingOrderSuccess,
  sanitizeCarrierTrackingUrl,
  serializePendingOrderSuccess,
  type PendingOrderSuccessSnapshot,
} from '~/commerce/lib/customer-order-lifecycle'
import { createOrderIssue } from '~/lib/orders/order-issue.service'
import {
  ISSUE_PRIORITY,
  OPEN_ISSUE_STATUSES,
  ORDER_ISSUE_TYPE,
  type OrderIssueType,
  type OrderStatus,
  type PaymentMode,
  type PaymentStatus,
} from '~/lib/orders/order.constants'
import type { OrderIssue } from '~/lib/orders/order-issue.type'
import type { OrderPayment } from '~/lib/orders/payment.type'
import type { OrderAddressSummary, OrderStatusLog } from '~/lib/orders/vendor-orders.type'
import { readSessionValue, writeSessionValue } from '~/lib/platform/storage'
import { supabase, type Json, type Tables } from '~/lib/supabase'

export type CustomerOrderItemRow = Tables<'order_items'> & {
  listings?: {
    id: string
    title: string | null
    slug: string | null
    listing_status: string | null
    stock: number | null
    listing_type: string | null
    listing_images?: Array<{
      id: string
      image_url: string
      is_primary: boolean | null
      display_order: number | null
    }> | null
  } | null
  shops?: {
    id: string
    shop_name: string | null
    slug: string | null
    logo_url: string | null
  } | null
}

export type CustomerOrderDelivery = Tables<'order_delivery'>

export type CustomerOrderDetail = {
  id: string
  order_number: string
  order_status: OrderStatus
  currency: string
  subtotal_amount: number
  shipping_amount: number | null
  tax_amount: number | null
  discount_amount: number | null
  total_amount: number
  customer_notes: string | null
  special_instructions: string | null
  estimated_delivery_date: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  completed_at: string | null
  shipping_address: OrderAddressSummary | null
  billing_address: OrderAddressSummary | null
  items: CustomerOrderItem[]
  deliveries: CustomerOrderPackage[]
  status_logs: OrderStatusLog[]
  payments: OrderPayment[]
  issues: OrderIssue[]
  shop_name: string | null
  payment_status: PaymentStatus | null
  payment_mode: PaymentMode | null
}

export type CustomerOrderItem = {
  id: string
  listing_id: string
  product_title: string
  product_sku: string | null
  quantity: number
  unit_price: number
  total_price: number
  item_status: OrderStatus
  variation_details: Json | null
  digital_download_url: string | null
  listing_slug: string | null
  listing_type: string | null
  image_url: string | null
  shop_id: string | null
  shop_name: string | null
  shop_slug: string | null
  variant_id: string | null
  available_stock: number | null
  listing_active: boolean
}

export type CustomerOrderPackage = {
  id: string
  delivery_status: string
  carrier_name: string | null
  courier_service_name: string | null
  tracking_number: string | null
  carrier_tracking_url: string | null
  estimated_delivery_date: string | null
  shipped_at: string | null
  delivered_at: string | null
  delivery_instructions: string | null
  delivery_metadata: Json
  status_history: Json | null
  order_item_id: string | null
  product_title: string | null
}

export type CustomerOrderSummary = {
  id: string
  order_number: string
  order_status: OrderStatus
  currency: string
  total_amount: number
  estimated_delivery_date: string | null
  created_at: string
  shop_name: string | null
  item_count: number
  payment_status: PaymentStatus | null
  payment_mode: PaymentMode | null
  tracking_numbers: string | null
}

const ADDRESS_FIELDS =
  'address_line_1, address_line_2, city, state, country, postal_code, address_label'

const ORDER_DETAIL_SELECT = `
  id,
  order_number,
  order_status,
  currency,
  subtotal_amount,
  shipping_amount,
  tax_amount,
  discount_amount,
  total_amount,
  customer_notes,
  special_instructions,
  estimated_delivery_date,
  created_at,
  updated_at,
  confirmed_at,
  shipped_at,
  delivered_at,
  completed_at,
  shipping_address:addresses!shipping_address_id (${ADDRESS_FIELDS}),
  billing_address:addresses!billing_address_id (${ADDRESS_FIELDS}),
  order_items (
    *,
    listings (
      id,
      title,
      slug,
      listing_status,
      stock,
      listing_type,
      listing_images ( id, image_url, is_primary, display_order )
    ),
    shops:shops!vendor_id ( id, shop_name, slug, logo_url )
  ),
  order_delivery (
    id,
    delivery_status,
    carrier_name,
    courier_service_name,
    tracking_number,
    carrier_tracking_url,
    estimated_delivery_date,
    shipped_at,
    delivered_at,
    delivery_instructions,
    delivery_metadata,
    status_history,
    order_item_id,
    created_at,
    updated_at
  ),
  order_status_logs ( * ),
  order_payments ( * ),
  order_issues ( * )
`

function primaryImageUrl(
  images:
    | Array<{
        image_url: string
        is_primary: boolean | null
        display_order: number | null
      }>
    | null
    | undefined,
): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort(
    (a, b) =>
      (a.is_primary ? -1 : 0) - (b.is_primary ? -1 : 0) ||
      (a.display_order ?? 0) - (b.display_order ?? 0),
  )
  return sorted[0]?.image_url ?? null
}

function variantIdFromDetails(details: Json | null): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const record = details as Record<string, unknown>
  return typeof record.variant_id === 'string' ? record.variant_id : null
}

function mapOrderItem(row: CustomerOrderItemRow): CustomerOrderItem {
  const listing = row.listings
  const shop = row.shops
  return {
    id: row.id,
    listing_id: row.listing_id,
    product_title: row.product_title,
    product_sku: row.product_sku,
    quantity: row.quantity,
    unit_price: row.unit_price,
    total_price: row.total_price,
    item_status: row.item_status,
    variation_details: row.variation_details,
    digital_download_url: row.digital_download_url,
    listing_slug: listing?.slug ?? null,
    listing_type: listing?.listing_type ?? null,
    image_url: primaryImageUrl(listing?.listing_images),
    shop_id: shop?.id ?? row.vendor_id,
    shop_name: shop?.shop_name ?? null,
    shop_slug: shop?.slug ?? null,
    variant_id: variantIdFromDetails(row.variation_details),
    available_stock: listing?.stock ?? null,
    listing_active: listing?.listing_status === 'active',
  }
}

function mapDelivery(
  row: CustomerOrderDelivery & { order_items?: { product_title?: string | null } | null },
): CustomerOrderPackage {
  return {
    id: row.id,
    delivery_status: row.delivery_status,
    carrier_name: row.carrier_name,
    courier_service_name: row.courier_service_name,
    tracking_number: row.tracking_number,
    carrier_tracking_url: sanitizeCarrierTrackingUrl(row.carrier_tracking_url),
    estimated_delivery_date: row.estimated_delivery_date,
    shipped_at: row.shipped_at,
    delivered_at: row.delivered_at,
    delivery_instructions: row.delivery_instructions,
    delivery_metadata: row.delivery_metadata,
    status_history: row.status_history,
    order_item_id: row.order_item_id,
    product_title: row.order_items?.product_title ?? null,
  }
}

function mapDetail(raw: Record<string, unknown>): CustomerOrderDetail {
  const itemsRaw = (raw.order_items as CustomerOrderItemRow[] | null) ?? []
  const items = itemsRaw.map(mapOrderItem)
  const deliveriesRaw = (raw.order_delivery as CustomerOrderDelivery[] | null) ?? []
  const payments = ((raw.order_payments as OrderPayment[] | null) ?? []).slice().sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const issues = ((raw.order_issues as OrderIssue[] | null) ?? []).slice().sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const statusLogs = ((raw.order_status_logs as OrderStatusLog[] | null) ?? [])
    .slice()
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())

  const shopNames = [...new Set(items.map((item) => item.shop_name).filter(Boolean))] as string[]
  const primaryPayment = payments[0] ?? null

  return {
    id: String(raw.id),
    order_number: String(raw.order_number),
    order_status: raw.order_status as OrderStatus,
    currency: String(raw.currency ?? 'INR'),
    subtotal_amount: Number(raw.subtotal_amount ?? 0),
    shipping_amount: (raw.shipping_amount as number | null) ?? null,
    tax_amount: (raw.tax_amount as number | null) ?? null,
    discount_amount: (raw.discount_amount as number | null) ?? null,
    total_amount: Number(raw.total_amount ?? 0),
    customer_notes: (raw.customer_notes as string | null) ?? null,
    special_instructions: (raw.special_instructions as string | null) ?? null,
    estimated_delivery_date: (raw.estimated_delivery_date as string | null) ?? null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    confirmed_at: (raw.confirmed_at as string | null) ?? null,
    shipped_at: (raw.shipped_at as string | null) ?? null,
    delivered_at: (raw.delivered_at as string | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    shipping_address: (raw.shipping_address as OrderAddressSummary | null) ?? null,
    billing_address: (raw.billing_address as OrderAddressSummary | null) ?? null,
    items,
    deliveries: deliveriesRaw.map((row) => mapDelivery(row)),
    status_logs: statusLogs,
    payments,
    issues,
    shop_name: shopNames.join(', ') || null,
    payment_status: (primaryPayment?.payment_status as PaymentStatus | null) ?? null,
    payment_mode: (primaryPayment?.payment_mode as PaymentMode | null) ?? null,
  }
}

export async function fetchCustomerOrderDetail(
  orderId: string,
  userId: string,
): Promise<{ order: CustomerOrderDetail | null; error: string | null }> {
  if (!orderId || !userId) return { order: null, error: 'Order not found' }

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { order: null, error: error.message }
  if (!data) return { order: null, error: 'Order not found' }

  return { order: mapDetail(data as unknown as Record<string, unknown>), error: null }
}

export async function fetchCustomerOrdersByIds(
  orderIds: string[],
  userId: string,
): Promise<{ orders: CustomerOrderSummary[]; error: string | null }> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  if (!ids.length || !userId) return { orders: [], error: null }

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      order_status,
      currency,
      total_amount,
      estimated_delivery_date,
      created_at,
      order_items ( id, shops:shops!vendor_id ( shop_name ) ),
      order_payments ( payment_status, payment_mode, created_at ),
      order_delivery ( tracking_number )
    `,
    )
    .eq('user_id', userId)
    .in('id', ids)

  if (error) return { orders: [], error: error.message }

  const byId = new Map<string, CustomerOrderSummary>()
  for (const row of data ?? []) {
    const items = (row.order_items as Array<{ shops?: { shop_name?: string | null } | null }> | null) ?? []
    const shopNames = [
      ...new Set(items.map((item) => item.shops?.shop_name).filter(Boolean)),
    ] as string[]
    const payments =
      ((row.order_payments as Array<{
        payment_status: PaymentStatus
        payment_mode: PaymentMode
        created_at: string
      }> | null) ??
        [])
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const tracking = (
      (row.order_delivery as Array<{ tracking_number?: string | null }> | null) ?? []
    )
      .map((d) => d.tracking_number)
      .filter(Boolean)
      .join(', ')

    byId.set(row.id, {
      id: row.id,
      order_number: row.order_number,
      order_status: row.order_status,
      currency: row.currency ?? 'INR',
      total_amount: Number(row.total_amount ?? 0),
      estimated_delivery_date: row.estimated_delivery_date,
      created_at: row.created_at,
      shop_name: shopNames.join(', ') || null,
      item_count: items.length,
      payment_status: payments[0]?.payment_status ?? null,
      payment_mode: payments[0]?.payment_mode ?? null,
      tracking_numbers: tracking || null,
    })
  }

  // Preserve checkout order when possible.
  const orders = ids.map((id) => byId.get(id)).filter((row): row is CustomerOrderSummary => Boolean(row))
  return { orders, error: null }
}

export async function savePendingOrderSuccess(snapshot: PendingOrderSuccessSnapshot): Promise<void> {
  await writeSessionValue(PENDING_ORDER_SUCCESS_KEY, serializePendingOrderSuccess(snapshot))
}

export async function loadPendingOrderSuccess(): Promise<PendingOrderSuccessSnapshot | null> {
  const raw = await readSessionValue(PENDING_ORDER_SUCCESS_KEY)
  return parsePendingOrderSuccess(raw)
}

export async function clearPendingOrderSuccess(): Promise<void> {
  await writeSessionValue(PENDING_ORDER_SUCCESS_KEY, '')
}

export function getOrderEligibility(order: CustomerOrderDetail) {
  return getCustomerOrderActionEligibility({
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    issues: order.issues,
  })
}

export async function requestOrderCancellation(input: {
  orderId: string
  userId: string
  reason: string
  orderItemId?: string | null
}): Promise<{ issue: OrderIssue | null; error: string | null }> {
  const { order, error } = await fetchCustomerOrderDetail(input.orderId, input.userId)
  if (error || !order) return { issue: null, error: error ?? 'Order not found' }

  const eligibility = getOrderEligibility(order)
  if (!eligibility.canCancel) {
    return { issue: null, error: eligibility.cancelBlockedReason ?? 'Cancellation unavailable' }
  }

  const response = await createOrderIssue(
    {
      order_id: input.orderId,
      order_item_id: input.orderItemId ?? order.items[0]?.id ?? null,
      issue_type: ORDER_ISSUE_TYPE.CANCELLATION_REQUEST,
      subject: `Cancellation request for order ${order.order_number}`,
      description: input.reason.trim(),
      priority: ISSUE_PRIORITY.HIGH,
    },
    input.userId,
  )

  if (!response.success || !response.data) {
    return { issue: null, error: response.error ?? 'Could not submit cancellation request' }
  }
  return { issue: response.data, error: null }
}

export async function createCustomerOrderSupportIssue(input: {
  orderId: string
  userId: string
  issueType: OrderIssueType | string
  description: string
  orderItemId?: string | null
  subject?: string | null
}): Promise<{ issue: OrderIssue | null; error: string | null }> {
  const { order, error } = await fetchCustomerOrderDetail(input.orderId, input.userId)
  if (error || !order) return { issue: null, error: error ?? 'Order not found' }

  const openDuplicate = order.issues.find(
    (issue) =>
      issue.issue_type === input.issueType &&
      (OPEN_ISSUE_STATUSES as string[]).includes(issue.status ?? ''),
  )
  if (openDuplicate) {
    return { issue: null, error: 'You already have an open request of this type for this order.' }
  }

  const response = await createOrderIssue(
    {
      order_id: input.orderId,
      order_item_id: input.orderItemId ?? null,
      issue_type: input.issueType,
      subject: input.subject?.trim() || `Help with order ${order.order_number}`,
      description: input.description.trim(),
      priority: ISSUE_PRIORITY.NORMAL,
    },
    input.userId,
  )

  if (!response.success || !response.data) {
    return { issue: null, error: response.error ?? 'Could not submit support request' }
  }
  return { issue: response.data, error: null }
}

export type ReorderCandidate = {
  item: CustomerOrderItem
  eligible: boolean
  reason: string | null
}

/** Decide which purchased lines can be re-added to cart. */
export function evaluateReorderCandidates(items: CustomerOrderItem[]) {
  return evaluateReorderCandidatesPure(items)
}

export function subscribeCustomerOrderChanges(
  orderId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`customer-order-${orderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_delivery', filter: `order_id=eq.${orderId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_status_logs',
        filter: `order_id=eq.${orderId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_issues', filter: `order_id=eq.${orderId}` },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
