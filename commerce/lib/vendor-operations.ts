import { supabase } from '~/lib/supabase/client'
export { rowsToCsv } from './vendor-operation-utils'

export type VendorAnalytics = {
  revenue: number
  orders: number
  units: number
  refunds: number
  customers: number
  topProducts: Array<{ title: string; revenue: number; units: number }>
}

export async function fetchVendorAnalytics(shopId: string): Promise<VendorAnalytics> {
  const { data } = await supabase
    .from('sales_analytics')
    .select('order_id, customer_id, product_title, quantity, total_revenue, refund_amount')
    .eq('shop_id', shopId)
    .order('ordered_at', { ascending: false })
    .limit(1000)

  const orders = new Set<string>()
  const customers = new Set<string>()
  const products = new Map<string, { revenue: number; units: number }>()
  let revenue = 0
  let units = 0
  let refunds = 0

  for (const row of data ?? []) {
    if (row.order_id) orders.add(row.order_id)
    if (row.customer_id) customers.add(row.customer_id)
    revenue += Number(row.total_revenue ?? 0)
    units += Number(row.quantity ?? 0)
    refunds += Number(row.refund_amount ?? 0)
    const current = products.get(row.product_title) ?? { revenue: 0, units: 0 }
    current.revenue += Number(row.total_revenue ?? 0)
    current.units += Number(row.quantity ?? 0)
    products.set(row.product_title, current)
  }

  return {
    revenue,
    orders: orders.size,
    units,
    refunds,
    customers: customers.size,
    topProducts: [...products.entries()]
      .map(([title, value]) => ({ title, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
  }
}

export type VendorFulfillment = {
  id: string
  number: string
  status: string
  productTitle: string
  quantity: number
  carrier: string | null
  tracking: string | null
  failure: string | null
  retryAt: string | null
  updatedAt: string
}

export async function fetchVendorFulfillments(shopId: string): Promise<VendorFulfillment[]> {
  const { data } = await supabase
    .from('order_fulfillments')
    .select(
      'id, fulfillment_number, fulfillment_status, quantity_to_fulfill, carrier_name, tracking_number, last_failure_reason, next_retry_at, updated_at, order_items!inner(product_title, vendor_id)',
    )
    .eq('order_items.vendor_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(100)

  return (data ?? []).map((row) => {
    const item = row.order_items as { product_title?: string } | null
    return {
      id: row.id,
      number: row.fulfillment_number,
      status: row.fulfillment_status,
      productTitle: item?.product_title ?? 'Order item',
      quantity: row.quantity_to_fulfill,
      carrier: row.carrier_name,
      tracking: row.tracking_number,
      failure: row.last_failure_reason,
      retryAt: row.next_retry_at,
      updatedAt: row.updated_at,
    }
  })
}

export async function resolveVendorFulfillmentException(input: {
  fulfillmentId: string
  note: string
  retryAt?: string | null
}) {
  const { error } = await supabase.rpc('resolve_fulfillment_exception' as never, {
    p_fulfillment_id: input.fulfillmentId,
    p_note: input.note,
    p_retry_at: input.retryAt ?? null,
  } as never)
  return error?.message ?? null
}

export type VendorReview = {
  id: string
  listingTitle: string
  rating: number
  title: string | null
  text: string
  verified: boolean
  createdAt: string
  replyCount: number
  vendorReply: string | null
}

export async function fetchVendorReviews(shopId: string): Promise<VendorReview[]> {
  const { data } = await supabase
    .from('listing_reviews')
    .select(
      'id, rating, title, review_text, is_verified_purchase, created_at, reply_count, listings!inner(title, shop_id), listing_review_replies(reply_text, is_vendor_reply, created_at)',
    )
    .eq('listings.shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []).map((row) => {
    const listing = row.listings as { title?: string } | null
    const replies = (row.listing_review_replies ?? []) as Array<{
      reply_text?: string
      is_vendor_reply?: boolean
      created_at?: string
    }>
    const vendorReply =
      replies
        .filter((reply) => reply.is_vendor_reply)
        .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0]
        ?.reply_text ?? null
    return {
      id: row.id,
      listingTitle: listing?.title ?? 'Listing',
      rating: row.rating,
      title: row.title,
      text: row.review_text,
      verified: row.is_verified_purchase,
      createdAt: row.created_at,
      replyCount: row.reply_count,
      vendorReply,
    }
  })
}

export async function replyToVendorReview(reviewId: string, reply: string) {
  const { error } = await supabase.rpc('vendor_reply_to_review' as never, {
    p_review_id: reviewId,
    p_reply: reply,
  } as never)
  return error?.message ?? null
}

export type VendorInquiry = {
  id: string
  listingId: string
  message: string
  status: string
  reply: string | null
  createdAt: string
}

export async function fetchVendorInquiries(shopId: string): Promise<VendorInquiry[]> {
  const { data } = await supabase
    .from('listing_inquiries')
    .select('id, listing_id, message, status, seller_reply, created_at')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100)
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    listingId: String(row.listing_id),
    message: String(row.message ?? ''),
    status: String(row.status ?? 'open'),
    reply: typeof row.seller_reply === 'string' ? row.seller_reply : null,
    createdAt: String(row.created_at),
  }))
}

export async function replyToVendorInquiry(inquiryId: string, reply: string, close = false) {
  const { error } = await supabase.rpc('reply_to_listing_inquiry' as never, {
    p_inquiry_id: inquiryId,
    p_reply: reply,
    p_close: close,
  } as never)
  return error?.message ?? null
}

export type VendorPromotion = {
  id: string
  name: string
  code: string | null
  type: string
  value: number
  active: boolean
  uses: number
  validUntil: string | null
}

export async function fetchVendorPromotions(shopId: string): Promise<VendorPromotion[]> {
  const { data } = await supabase
    .from('discount_profiles')
    .select(
      'id, discount_name, discount_code, discount_type, discount_value, is_active, total_uses, valid_until',
    )
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.discount_name,
    code: row.discount_code,
    type: row.discount_type,
    value: Number(row.discount_value),
    active: row.is_active,
    uses: row.total_uses ?? 0,
    validUntil: row.valid_until,
  }))
}

export async function createVendorPromotion(input: {
  shopId: string
  name: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  validUntil?: string | null
}) {
  const { error } = await supabase.rpc('vendor_create_promotion' as never, {
    p_shop_id: input.shopId,
    p_name: input.name,
    p_code: input.code,
    p_discount_type: input.type,
    p_discount_value: input.value,
    p_valid_until: input.validUntil ?? null,
  } as never)
  return error?.message ?? null
}

export async function bulkUpdateVendorListings(input: {
  shopId: string
  listingIds: string[]
  status?: string | null
  pricePercent?: number | null
  stockDelta?: number | null
  category?: string | null
}) {
  const { data, error } = await supabase.rpc('vendor_bulk_update_listings' as never, {
    p_shop_id: input.shopId,
    p_listing_ids: input.listingIds,
    p_status: input.status ?? null,
    p_price_percent: input.pricePercent ?? null,
    p_stock_delta: input.stockDelta ?? null,
    p_category: input.category ?? null,
  } as never)
  return { count: Number(data ?? 0), error: error?.message ?? null }
}

export type VendorShopSection = {
  id: string
  name: string
  description: string | null
  active: boolean
  listingIds: string[]
}

export async function fetchVendorShopSections(shopId: string): Promise<VendorShopSection[]> {
  const { data } = await supabase
    .from('shop_sections')
    .select('id, section_name, description, is_active, display_order, listing_sections(listing_id)')
    .eq('shop_id', shopId)
    .order('display_order')
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.section_name,
    description: row.description,
    active: row.is_active,
    listingIds: (row.listing_sections ?? []).map((link) => link.listing_id),
  }))
}

export async function saveVendorShopSection(input: {
  shopId: string
  sectionId?: string | null
  name: string
  description?: string | null
  active?: boolean
  listingIds?: string[]
}) {
  const { data, error } = await supabase.rpc('save_shop_section' as never, {
    p_shop_id: input.shopId,
    p_section_id: input.sectionId ?? null,
    p_name: input.name,
    p_description: input.description ?? null,
    p_is_active: input.active ?? true,
    p_listing_ids: input.listingIds ?? [],
  } as never)
  return { id: typeof data === 'string' ? data : null, error: error?.message ?? null }
}

