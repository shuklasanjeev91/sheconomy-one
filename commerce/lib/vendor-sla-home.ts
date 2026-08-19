import {
  buildVendorSlaInboxData,
  type VendorSlaInboxRow,
  type VendorSlaSeverity,
} from '~/commerce/lib/vendor-sla-inbox'
import { getVendorIssues } from '~/lib/orders/order-issue.service'
import { getVendorOrders } from '~/lib/orders/vendor-orders.service'
import { vendorRoutes } from '~/lib/routes'

export type VendorSlaHomeCard = {
  id: string
  title: string
  badge: string
  detail: string
  dueLabel: string
  severity: VendorSlaSeverity
  href: string
}

export function buildVendorSlaHomeCards(rows: VendorSlaInboxRow[], limit = 5): VendorSlaHomeCard[] {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    title: row.title,
    badge: row.nextActionLabel,
    detail: row.description,
    dueLabel: row.dueLabel,
    severity: row.severity,
    href: vendorRoutes.ordersSection('inbox'),
  }))
}

export async function fetchVendorSlaHomeCards(
  shopId: string,
  userId: string,
  limit = 5,
): Promise<{ cards: VendorSlaHomeCard[]; error: string | null }> {
  const [ordersResult, issuesResult] = await Promise.all([
    getVendorOrders(shopId, {}, { page: 1, limit: 100, order_by: 'created_at', order_direction: 'desc' }, userId),
    getVendorIssues(shopId, { page: 1, limit: 100, sort_by: 'created_at', sort_order: 'desc' }),
  ])

  if (ordersResult.error && issuesResult.error) {
    return { cards: [], error: ordersResult.error ?? issuesResult.error }
  }

  const inbox = buildVendorSlaInboxData({
    orders: ordersResult.data?.items ?? [],
    issues: issuesResult.data?.issues ?? [],
  })

  return {
    cards: buildVendorSlaHomeCards(inbox.rows, limit),
    error: null,
  }
}
