import {
  getBuyerReturnHubEntries,
  type BuyerReturnHubCategory,
  type BuyerReturnHubEntry,
} from '~/commerce/lib/customer-order-lifecycle'
import { fetchRefundsForOrderItems } from '~/commerce/lib/customer-order-trust'
import { OPEN_ISSUE_STATUSES } from '~/lib/orders/order.constants'
import { isExchangeIssueType, isReturnIssueType } from '~/lib/orders/order-issue.utils'
import { supabase } from '~/lib/supabase/client'

export type BuyerReturnHomeCard = {
  orderId: string
  orderNumber: string
  issueId: string
  itemTitle: string
  actionLabel: string
  actionDetail: string | null
  category: BuyerReturnHubCategory
  returnTrackingUrl: string | null
}

type IssueRow = {
  id: string
  order_id: string
  order_item_id: string | null
  issue_type: string | null
  status: string | null
  resolution_action: string | null
  return_tracking_number: string | null
  return_courier_slug: string | null
  return_tracking_url: string | null
  return_shipping_mode: string | null
  reject_reason_code: string | null
  resolution_note: string | null
  evidence_urls: string[] | null
  created_at: string | null
  orders: {
    id: string
    order_number: string
    currency: string | null
  } | null
  order_items: {
    id: string
    product_title: string | null
  } | null
}

const ACTIVE_CATEGORIES = new Set<BuyerReturnHubCategory>(['needs_action', 'in_progress'])

export function selectBuyerReturnHomeCards(
  entries: Array<BuyerReturnHubEntry & { orderId: string; orderNumber: string }>,
  limit: number,
): BuyerReturnHomeCard[] {
  return entries
    .filter((entry) => ACTIVE_CATEGORIES.has(entry.category))
    .slice(0, limit)
    .map((entry) => ({
      orderId: entry.orderId,
      orderNumber: entry.orderNumber,
      issueId: entry.issueId,
      itemTitle: entry.itemTitle,
      actionLabel: entry.actionLabel,
      actionDetail: entry.actionDetail,
      category: entry.category,
      returnTrackingUrl: entry.returnTrackingUrl,
    }))
}

export async function fetchBuyerReturnHomeCards(
  userId: string,
  limit = 4,
): Promise<{ cards: BuyerReturnHomeCard[]; error: string | null }> {
  const { data, error } = await supabase
    .from('order_issues')
    .select(
      `
      id,
      order_id,
      order_item_id,
      issue_type,
      status,
      resolution_action,
      return_tracking_number,
      return_courier_slug,
      return_tracking_url,
      return_shipping_mode,
      reject_reason_code,
      resolution_note,
      evidence_urls,
      created_at,
      orders!inner ( id, order_number, user_id, currency ),
      order_items ( id, product_title )
    `,
    )
    .eq('orders.user_id', userId)
    .in('status', OPEN_ISSUE_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return { cards: [], error: error.message }

  const rows = ((data ?? []) as IssueRow[]).filter(
    (row) => isReturnIssueType(row.issue_type) || isExchangeIssueType(row.issue_type),
  )
  if (!rows.length) return { cards: [], error: null }

  const grouped = new Map<string, IssueRow[]>()
  for (const row of rows) {
    const orderId = row.orders?.id ?? row.order_id
    const bucket = grouped.get(orderId) ?? []
    bucket.push(row)
    grouped.set(orderId, bucket)
  }

  const itemIds = rows
    .map((row) => row.order_item_id ?? row.order_items?.id ?? null)
    .filter((id): id is string => Boolean(id))
  const { refunds } = await fetchRefundsForOrderItems(itemIds)

  const entries: Array<BuyerReturnHubEntry & { orderId: string; orderNumber: string }> = []

  for (const [orderId, orderRows] of grouped) {
    const orderNumber = orderRows[0]?.orders?.order_number ?? orderId
    const currency = orderRows[0]?.orders?.currency ?? 'INR'
    const items = orderRows
      .map((row) => row.order_items)
      .filter((item): item is NonNullable<IssueRow['order_items']> => Boolean(item))
    const issues = orderRows.map((row) => ({
      id: row.id,
      order_item_id: row.order_item_id,
      issue_type: row.issue_type,
      status: row.status,
      resolution_action: row.resolution_action,
      return_tracking_number: row.return_tracking_number,
      return_courier_slug: row.return_courier_slug,
      return_tracking_url: row.return_tracking_url,
      return_shipping_mode: row.return_shipping_mode,
      reject_reason_code: row.reject_reason_code,
      resolution_note: row.resolution_note,
      evidence_urls: row.evidence_urls,
      created_at: row.created_at,
    }))

    for (const entry of getBuyerReturnHubEntries({ items, issues, refunds, currency })) {
      entries.push({ ...entry, orderId, orderNumber })
    }
  }

  entries.sort((a, b) => {
    const rank = { needs_action: 0, in_progress: 1, declined: 2, resolved: 3 } satisfies Record<
      BuyerReturnHubCategory,
      number
    >
    return rank[a.category] - rank[b.category]
  })

  return { cards: selectBuyerReturnHomeCards(entries, limit), error: null }
}
