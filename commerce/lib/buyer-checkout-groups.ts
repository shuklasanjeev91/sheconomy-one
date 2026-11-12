/**
 * Buyer checkout-group (parent) tracking: N independent seller (child) orders
 * under one paid checkout, with settlement + delivery summaries.
 */

import { buildCustomerOrderTimeline } from '~/commerce/lib/customer-order-lifecycle'
import type { CustomerTimelineEvent } from '~/commerce/lib/customer-order-lifecycle'
import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type BuyerCheckoutGroupListRow = {
  id: string
  status: string
  payment_mode: string
  currency: string
  total_amount: number
  subtotal_amount: number
  discount_amount: number
  order_ids: string[]
  created_at: string
  paid_at: string | null
  shop_count: number
  shop_names: string
  overall_status: BuyerGroupOverallStatus
  item_count: number
}

export type BuyerGroupOverallStatus =
  | 'awaiting_payment'
  | 'processing'
  | 'partially_delivered'
  | 'delivered'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled'
  | 'shipped'
  | 'confirmed'

export type BuyerShopOrderCard = {
  order_id: string
  order_number: string
  order_status: string
  shop_id: string | null
  shop_name: string
  shop_slug: string | null
  shop_logo_url: string | null
  currency: string
  subtotal_amount: number
  shipping_amount: number
  total_amount: number
  item_count: number
  items: Array<{
    id: string
    title: string
    quantity: number
    unit_price: number
    item_status: string | null
  }>
  awb: string | null
  tracking_number: string | null
  delivery_status: string | null
  settlement_status: string | null
  settlement_hold_reason: string | null
  settlement_eligible_at: string | null
  is_cancelled: boolean
  is_refunded: boolean
  is_delivered: boolean
}

export type BuyerCheckoutGroupDetail = {
  group: Tables<'commerce_checkout_groups'>
  overall_status: BuyerGroupOverallStatus
  shops: BuyerShopOrderCard[]
  timeline: CustomerTimelineEvent[]
  edge_notes: string[]
}

const TERMINAL_CANCEL = new Set(['cancelled', 'canceled'])
const TERMINAL_REFUND = new Set(['refunded', 'partially_refunded'])
const DELIVERED = new Set(['delivered', 'completed'])
const SHIPPED = new Set([
  'shipped',
  'in_transit',
  'out_for_delivery',
  'packed',
])

export function deriveBuyerGroupOverallStatus(
  orderStatuses: string[],
): BuyerGroupOverallStatus {
  if (!orderStatuses.length) return 'processing'
  const normalized = orderStatuses.map((s) => (s ?? 'processing').toLowerCase())

  const allCancelled = normalized.every((s) => TERMINAL_CANCEL.has(s))
  if (allCancelled) return 'cancelled'

  const allRefunded = normalized.every((s) => s === 'refunded')
  if (allRefunded) return 'refunded'

  const anyRefund = normalized.some((s) => TERMINAL_REFUND.has(s))
  const anyActive = normalized.some(
    (s) => !TERMINAL_CANCEL.has(s) && s !== 'refunded',
  )
  if (anyRefund && anyActive) return 'partially_refunded'
  if (anyRefund && !anyActive) return 'partially_refunded'

  const active = normalized.filter((s) => !TERMINAL_CANCEL.has(s) && s !== 'refunded')
  if (!active.length) return 'cancelled'

  const allDelivered = active.every((s) => DELIVERED.has(s))
  if (allDelivered) return 'delivered'

  const anyDelivered = active.some((s) => DELIVERED.has(s))
  if (anyDelivered) return 'partially_delivered'

  // Only explicit awaiting_payment means unpaid. `pending` is post-checkout
  // processing in this codebase and must not collapse to awaiting payment.
  if (active.some((s) => s === 'awaiting_payment')) {
    return 'awaiting_payment'
  }

  if (active.some((s) => SHIPPED.has(s))) return 'shipped'
  if (
    active.some((s) =>
      s === 'confirmed' || s === 'processing' || s === 'paid' || s === 'pending',
    )
  ) {
    return 'confirmed'
  }

  return 'processing'
}

export function buyerGroupOverallStatusLabel(status: BuyerGroupOverallStatus): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Awaiting payment'
    case 'partially_delivered':
      return 'Partially delivered'
    case 'partially_refunded':
      return 'Partially refunded'
    case 'delivered':
      return 'Delivered'
    case 'refunded':
      return 'Refunded'
    case 'cancelled':
      return 'Cancelled'
    case 'shipped':
      return 'Shipped'
    case 'confirmed':
      return 'Confirmed'
    default:
      return 'Processing'
  }
}

export function settlementStatusLabel(
  status: string | null,
  holdReason: string | null,
): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'released' || s === 'settled') return 'Settled'
  if (s === 'failed') return 'Settlement failed'
  if (holdReason === 'dispute') return 'On hold — dispute'
  if (holdReason === 'refunded') return 'Held — refund'
  if (holdReason === 'awaiting_delivery') return 'Held until delivery'
  if (holdReason === 'awaiting_child') return 'Held — seller setup'
  if (s === 'pending' || s === 'held' || s === 'scheduled') return 'Settlement pending'
  if (!s) return 'No settlement record'
  return s.replace(/_/g, ' ')
}

export async function fetchBuyerCheckoutGroupList(userId: string): Promise<{
  groups: BuyerCheckoutGroupListRow[]
  orphanOrders: string[]
  error: string | null
}> {
  const { data: groups, error } = await supabase
    .from('commerce_checkout_groups')
    .select(
      'id, status, payment_mode, currency, total_amount, subtotal_amount, discount_amount, order_ids, created_at, paid_at',
    )
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return { groups: [], orphanOrders: [], error: error.message }
  }

  const rows = groups ?? []
  const allOrderIds = Array.from(
    new Set(rows.flatMap((g) => g.order_ids ?? []).filter(Boolean)),
  )

  let orderMeta = new Map<
    string,
    { order_status: string; shop_names: string[]; item_count: number }
  >()

  if (allOrderIds.length) {
    const { data: orders } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_status,
        order_items (
          id,
          shops:shops!vendor_id ( shop_name )
        )
      `,
      )
      .in('id', allOrderIds)
      .eq('user_id', userId)

    for (const order of orders ?? []) {
      const items = (order.order_items ?? []) as Array<{
        id: string
        shops?: { shop_name: string | null } | null
      }>
      const names = Array.from(
        new Set(
          items
            .map((i) => i.shops?.shop_name)
            .filter((n): n is string => Boolean(n && n.trim())),
        ),
      )
      orderMeta.set(order.id, {
        order_status: String(order.order_status ?? 'processing'),
        shop_names: names,
        item_count: items.length,
      })
    }
  }

  const list: BuyerCheckoutGroupListRow[] = rows.map((g) => {
    const ids = g.order_ids ?? []
    const statuses = ids.map((id) => orderMeta.get(id)?.order_status ?? 'processing')
    const shopNames = Array.from(
      new Set(ids.flatMap((id) => orderMeta.get(id)?.shop_names ?? [])),
    )
    const itemCount = ids.reduce(
      (sum, id) => sum + (orderMeta.get(id)?.item_count ?? 0),
      0,
    )
    return {
      id: g.id,
      status: g.status,
      payment_mode: g.payment_mode,
      currency: g.currency,
      total_amount: Number(g.total_amount ?? 0),
      subtotal_amount: Number(g.subtotal_amount ?? 0),
      discount_amount: Number(g.discount_amount ?? 0),
      order_ids: ids,
      created_at: g.created_at,
      paid_at: g.paid_at,
      shop_count: shopNames.length || ids.length,
      shop_names: shopNames.join(', ') || `${ids.length} shop${ids.length === 1 ? '' : 's'}`,
      overall_status: deriveBuyerGroupOverallStatus(statuses),
      item_count: itemCount,
    }
  })

  return { groups: list, orphanOrders: [], error: null }
}

export async function fetchBuyerCheckoutGroupDetail(
  groupId: string,
  userId: string,
): Promise<{ detail: BuyerCheckoutGroupDetail | null; error: string | null }> {
  const { data: group, error } = await supabase
    .from('commerce_checkout_groups')
    .select('*')
    .eq('id', groupId)
    .eq('buyer_id', userId)
    .maybeSingle()

  if (error) return { detail: null, error: error.message }
  if (!group) return { detail: null, error: 'Checkout not found' }

  const orderIds = group.order_ids ?? []
  if (!orderIds.length) {
    return {
      detail: {
        group,
        overall_status: 'processing',
        shops: [],
        timeline: [],
        edge_notes: [],
      },
      error: null,
    }
  }

  const [{ data: orders, error: ordersError }, { data: settlements }, { data: deliveries }, { data: statusLogs }] =
    await Promise.all([
      supabase
        .from('orders')
        .select(
          `
          id,
          order_number,
          order_status,
          currency,
          customer_currency,
          subtotal_amount,
          shipping_amount,
          total_amount,
          customer_subtotal_amount,
          customer_shipping_amount,
          customer_total_amount,
          created_at,
          order_items (
            id,
            product_title,
            quantity,
            unit_price,
            total_price,
            item_status,
            vendor_id,
            shops:shops!vendor_id ( id, shop_name, slug, logo_url )
          )
        `,
        )
        .in('id', orderIds)
        .eq('user_id', userId),
      supabase
        .from('shepay_pending_settlements')
        .select('order_id, shop_id, status, hold_reason, eligible_at')
        .in('order_id', orderIds),
      supabase
        .from('order_delivery')
        .select(
          'id, order_id, delivery_status, tracking_number, awb_code, carrier_name, shipped_at, delivered_at, created_at, updated_at, delivery_metadata, status_history, estimated_delivery_date',
        )
        .in('order_id', orderIds),
      supabase
        .from('order_status_logs')
        .select('id, order_id, to_status, note, change_reason, changed_at')
        .in('order_id', orderIds)
        .order('changed_at', { ascending: true }),
    ])

  if (ordersError) return { detail: null, error: ordersError.message }

  const settlementByOrder = new Map<
    string,
    { status: string | null; hold_reason: string | null; eligible_at: string | null }
  >()
  for (const row of settlements ?? []) {
    if (!row.order_id) continue
    settlementByOrder.set(row.order_id, {
      status: row.status,
      hold_reason: row.hold_reason,
      eligible_at: row.eligible_at,
    })
  }

  const deliveriesByOrder = new Map<string, typeof deliveries>()
  for (const d of deliveries ?? []) {
    const list = deliveriesByOrder.get(d.order_id) ?? []
    list.push(d)
    deliveriesByOrder.set(d.order_id, list)
  }

  const shops: BuyerShopOrderCard[] = []
  const edge_notes: string[] = []
  const orderStatuses: string[] = []
  const foundOrderIds = new Set((orders ?? []).map((o) => o.id))
  const missingOrderCount = orderIds.filter((id) => !foundOrderIds.has(id)).length
  if (missingOrderCount > 0) {
    edge_notes.push(
      missingOrderCount === orderIds.length
        ? 'Seller order records for this checkout are no longer available.'
        : `${missingOrderCount} of ${orderIds.length} seller orders could not be loaded.`,
    )
  }

  for (const order of orders ?? []) {
    const items = (order.order_items ?? []) as Array<{
      id: string
      product_title: string | null
      quantity: number
      unit_price: number
      total_price: number | null
      item_status: string | null
      vendor_id: string | null
      shops?: {
        id: string
        shop_name: string | null
        slug: string | null
        logo_url: string | null
      } | null
    }>

    // One child order is typically one shop; group items by vendor just in case.
    const byShop = new Map<string, typeof items>()
    for (const item of items) {
      const key = item.vendor_id ?? item.shops?.id ?? 'unknown'
      const bucket = byShop.get(key) ?? []
      bucket.push(item)
      byShop.set(key, bucket)
    }

    const status = String(order.order_status ?? 'processing')
    orderStatuses.push(status)
    const orderDeliveries = deliveriesByOrder.get(order.id) ?? []
    const primaryDelivery = orderDeliveries[0]
    const settlement = settlementByOrder.get(order.id)

    for (const [shopKey, shopItems] of byShop) {
      const shop = shopItems[0]?.shops
      const subtotal = shopItems.reduce(
        (sum, i) => sum + Number(i.unit_price ?? 0) * Number(i.quantity ?? 0),
        0,
      )
      const shipping = Number(
        order.customer_shipping_amount ?? order.shipping_amount ?? 0,
      )
      const total = Number(
        order.customer_total_amount ?? order.total_amount ?? subtotal + shipping,
      )
      const is_cancelled = TERMINAL_CANCEL.has(status.toLowerCase())
      const is_refunded = status.toLowerCase() === 'refunded'
      const is_delivered = DELIVERED.has(status.toLowerCase())

      shops.push({
        order_id: order.id,
        order_number: order.order_number,
        order_status: status,
        shop_id: shop?.id ?? (shopKey !== 'unknown' ? shopKey : null),
        shop_name: shop?.shop_name ?? 'Shop',
        shop_slug: shop?.slug ?? null,
        shop_logo_url: shop?.logo_url ?? null,
        currency: order.customer_currency ?? order.currency ?? group.currency,
        subtotal_amount: subtotal,
        shipping_amount: shipping,
        total_amount: total,
        item_count: shopItems.length,
        items: shopItems.map((i) => ({
          id: i.id,
          title: i.product_title ?? 'Item',
          quantity: i.quantity,
          unit_price: Number(i.unit_price ?? 0),
          item_status: i.item_status,
        })),
        awb: primaryDelivery?.awb_code ?? null,
        tracking_number:
          primaryDelivery?.tracking_number ?? primaryDelivery?.awb_code ?? null,
        delivery_status: primaryDelivery?.delivery_status ?? null,
        settlement_status: settlement?.status ?? null,
        settlement_hold_reason: settlement?.hold_reason ?? null,
        settlement_eligible_at: settlement?.eligible_at ?? null,
        is_cancelled,
        is_refunded,
        is_delivered,
      })
    }
  }

  const overall_status = deriveBuyerGroupOverallStatus(orderStatuses)
  if (overall_status === 'partially_delivered') {
    edge_notes.push('Some sellers have delivered; others are still in progress.')
  }
  if (overall_status === 'partially_refunded') {
    edge_notes.push('Part of this checkout was refunded; remaining shops may still fulfill.')
  }
  if (shops.some((s) => s.is_cancelled) && shops.some((s) => !s.is_cancelled)) {
    edge_notes.push('One or more seller orders were cancelled; others continue independently.')
  }

  // Consolidated timeline across all child orders (newest last, then mark current).
  const timelineParts: CustomerTimelineEvent[] = []
  for (const order of orders ?? []) {
    const part = buildCustomerOrderTimeline({
      orderStatus: String(order.order_status),
      statusLogs: (statusLogs ?? []).filter((l) => l.order_id === order.id),
      deliveries: (deliveries ?? []).filter((d) => d.order_id === order.id),
      createdAt: order.created_at,
    })
    const shopLabel =
      shops.find((s) => s.order_id === order.id)?.shop_name ?? order.order_number
    for (const event of part) {
      timelineParts.push({
        ...event,
        id: `${order.id}-${event.id}`,
        label: `${shopLabel}: ${event.label}`,
      })
    }
  }

  timelineParts.sort((a, b) => {
    const at = a.at ? new Date(a.at).getTime() : 0
    const bt = b.at ? new Date(b.at).getTime() : 0
    return at - bt
  })
  for (let i = 0; i < timelineParts.length; i++) {
    timelineParts[i] = {
      ...timelineParts[i],
      isCurrent: i === timelineParts.length - 1,
    }
  }

  // Preserve group order_ids order for shop cards
  const orderRank = new Map(orderIds.map((id, idx) => [id, idx]))
  shops.sort(
    (a, b) => (orderRank.get(a.order_id) ?? 0) - (orderRank.get(b.order_id) ?? 0),
  )

  return {
    detail: {
      group,
      overall_status,
      shops,
      timeline: timelineParts,
      edge_notes,
    },
    error: null,
  }
}

export function subscribeBuyerCheckoutGroupChanges(
  orderIds: string[],
  onChange: () => void,
): () => void {
  const unique = Array.from(new Set(orderIds.filter(Boolean)))
  if (!unique.length) return () => undefined

  const channelName = `buyer-checkout-${unique.slice().sort().join('-').slice(0, 100)}`
  let channel = supabase.channel(channelName)

  for (const orderId of unique) {
    channel = channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_delivery',
          filter: `order_id=eq.${orderId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shepay_pending_settlements',
          filter: `order_id=eq.${orderId}`,
        },
        () => onChange(),
      )
  }

  channel.subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
