import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'
import type { CrmJourneySegment, CrmRfmSegment } from '~/commerce/lib/customer-crm-scoring'

export type ShopCustomerCrmRow = {
  customer_id: string
  display_name: string
  username: string | null
  avatar_url: string | null
  total_orders: number
  total_spent: number
  average_order_value: number
  first_order_at: string | null
  last_order_at: string | null
  days_since_last_order: number | null
  rfm_segment: CrmRfmSegment
  clv: number
  predicted_clv: number
  churn_score: number
  intent_score: number
  insight: string
  is_follower: boolean
  open_cart_value: number
  wishlist_count: number
  recent_view_count: number
  refunded_orders: number
  tags: string[]
}

export type ShopCustomerNote = Tables<'shop_customer_notes'>
export type ShopCustomerJourney = Tables<'shop_customer_journeys'>

export type ShopCustomerPurchase = {
  order_number: string
  product_title: string
  total_revenue: number
  ordered_at: string
  quantity: number
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function asSegment(value: unknown): CrmRfmSegment {
  const raw = typeof value === 'string' ? value : 'hibernating'
  if (
    raw === 'champion' ||
    raw === 'loyal' ||
    raw === 'promising' ||
    raw === 'new' ||
    raw === 'at_risk' ||
    raw === 'lost'
  ) {
    return raw
  }
  return 'hibernating'
}

function mapCrmRow(row: Record<string, unknown>): ShopCustomerCrmRow {
  const tagsRaw = row.tags
  return {
    customer_id: String(row.customer_id ?? ''),
    display_name: String(row.display_name || 'Customer'),
    username: typeof row.username === 'string' ? row.username : null,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    total_orders: asNumber(row.total_orders),
    total_spent: asNumber(row.total_spent),
    average_order_value: asNumber(row.average_order_value),
    first_order_at: typeof row.first_order_at === 'string' ? row.first_order_at : null,
    last_order_at: typeof row.last_order_at === 'string' ? row.last_order_at : null,
    days_since_last_order:
      row.days_since_last_order == null ? null : asNumber(row.days_since_last_order),
    rfm_segment: asSegment(row.rfm_segment),
    clv: asNumber(row.clv),
    predicted_clv: asNumber(row.predicted_clv),
    churn_score: asNumber(row.churn_score),
    intent_score: asNumber(row.intent_score),
    insight: String(row.insight || ''),
    is_follower: Boolean(row.is_follower),
    open_cart_value: asNumber(row.open_cart_value),
    wishlist_count: asNumber(row.wishlist_count),
    recent_view_count: asNumber(row.recent_view_count),
    refunded_orders: asNumber(row.refunded_orders),
    tags: Array.isArray(tagsRaw) ? tagsRaw.map((tag) => String(tag)).filter(Boolean) : [],
  }
}

export async function fetchShopCustomerCrm(shopId: string): Promise<ShopCustomerCrmRow[]> {
  const { data, error } = await supabase.rpc('get_shop_customer_crm', {
    p_shop_id: shopId,
    p_limit: 200,
  })
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapCrmRow)
}

export async function fetchShopCustomerNotes(
  shopId: string,
  customerId: string,
): Promise<ShopCustomerNote[]> {
  const { data, error } = await supabase
    .from('shop_customer_notes')
    .select('*')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error || !data) return []
  return data
}

export async function addShopCustomerNote(
  shopId: string,
  customerId: string,
  body: string,
): Promise<ShopCustomerNote | null> {
  const trimmed = body.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from('shop_customer_notes')
    .insert({ shop_id: shopId, customer_id: customerId, body: trimmed })
    .select('*')
    .maybeSingle()
  if (error) return null
  return data
}

export async function addShopCustomerTag(
  shopId: string,
  customerId: string,
  tag: string,
): Promise<boolean> {
  const normalized = tag.trim().toLowerCase().slice(0, 40)
  if (!normalized) return false
  const { error } = await supabase.from('shop_customer_tags').insert({
    shop_id: shopId,
    customer_id: customerId,
    tag: normalized,
  })
  return !error
}

export async function removeShopCustomerTag(
  shopId: string,
  customerId: string,
  tag: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('shop_customer_tags')
    .delete()
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .eq('tag', tag)
  return !error
}

export async function fetchShopCustomerJourneys(shopId: string): Promise<ShopCustomerJourney[]> {
  await supabase.rpc('ensure_shop_customer_journeys', { p_shop_id: shopId })
  const { data, error } = await supabase
    .from('shop_customer_journeys')
    .select('*')
    .eq('shop_id', shopId)
    .order('segment')
  if (error || !data) return []
  return data
}

export async function setShopCustomerJourneyActive(
  journeyId: string,
  isActive: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('shop_customer_journeys')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', journeyId)
  return !error
}

export async function runShopCustomerJourneys(shopId: string): Promise<number> {
  const { data } = await supabase.rpc('process_shop_customer_journeys', {
    p_shop_id: shopId,
    p_limit: 80,
  })
  return typeof data === 'number' ? data : 0
}

export async function fetchShopCustomerPurchases(
  shopId: string,
  customerId: string,
): Promise<ShopCustomerPurchase[]> {
  const { data, error } = await supabase
    .from('sales_analytics')
    .select('order_number, product_title, total_revenue, ordered_at, quantity')
    .eq('shop_id', shopId)
    .eq('customer_id', customerId)
    .order('ordered_at', { ascending: false })
    .limit(8)
  if (error || !data) return []
  return data.map((row) => ({
    order_number: row.order_number,
    product_title: row.product_title,
    total_revenue: asNumber(row.total_revenue),
    ordered_at: row.ordered_at,
    quantity: asNumber(row.quantity),
  }))
}

export function filterShopCustomers(
  rows: ShopCustomerCrmRow[],
  query: string,
  filter: 'all' | CrmRfmSegment | 'high_intent' | 'churn_risk',
): ShopCustomerCrmRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (filter === 'high_intent' && row.intent_score < 50) return false
    if (filter === 'churn_risk' && row.churn_score < 60) return false
    if (
      filter !== 'all' &&
      filter !== 'high_intent' &&
      filter !== 'churn_risk' &&
      row.rfm_segment !== filter
    ) {
      return false
    }
    if (!needle) return true
    return (
      row.display_name.toLowerCase().includes(needle) ||
      (row.username ?? '').toLowerCase().includes(needle) ||
      row.tags.some((tag) => tag.includes(needle))
    )
  })
}

export type { CrmJourneySegment }
