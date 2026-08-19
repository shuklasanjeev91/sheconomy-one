import { buildPostPurchaseNudges, type PostPurchaseNudgeItem } from '~/commerce/lib/post-purchase-nudges'
import { fetchCustomerOrderDetail } from '~/commerce/lib/customer-orders'
import { ORDER_STATUS } from '~/lib/orders/order.constants'
import { supabase } from '~/lib/supabase/client'

export async function fetchPostPurchaseHomeNudges(
  userId: string,
  limit = 6,
): Promise<{ items: PostPurchaseNudgeItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .in('order_status', [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED])
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) return { items: [], error: error.message }

  const items: PostPurchaseNudgeItem[] = []
  for (const row of data ?? []) {
    if (items.length >= limit) break
    const detail = await fetchCustomerOrderDetail(row.id, userId)
    if (!detail.order) continue
    const nudges = buildPostPurchaseNudges({
      orderStatus: detail.order.order_status,
      items: detail.order.items,
    })
    for (const section of nudges.sections) {
      for (const item of section.items) {
        if (items.length >= limit) break
        items.push(item)
      }
    }
  }

  return { items, error: null }
}
