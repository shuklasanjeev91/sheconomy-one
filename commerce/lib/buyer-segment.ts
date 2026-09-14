import { DISCOUNT_USER_TYPES } from '~/lib/discount/discount.constants'
import type { DiscountUserType } from '~/lib/discount/discount.type'
import { isUserTypeEligible } from '~/lib/discount/discount.utils'
import { supabase } from '~/lib/supabase/client'

const VIP_ORDER_THRESHOLD = 5

export async function fetchBuyerDiscountUserType(userId?: string | null): Promise<DiscountUserType> {
  if (!userId) return DISCOUNT_USER_TYPES.NEW
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('order_status', 'eq', 'cancelled')
    .not('order_status', 'eq', 'refunded')

  if (error || count == null) return DISCOUNT_USER_TYPES.NEW
  if (count === 0) return DISCOUNT_USER_TYPES.NEW
  if (count >= VIP_ORDER_THRESHOLD) return DISCOUNT_USER_TYPES.VIP
  return DISCOUNT_USER_TYPES.RETURNING
}

export function buyerCanUseDiscountUserTypes(
  eligible: string[] | null | undefined,
  buyerType: string | null | undefined,
): boolean {
  return isUserTypeEligible(buyerType, eligible)
}
