import { supabase } from '~/lib/supabase/client'

/** Sum of SHEPay amounts held until this shop connects a child merchant. */
export async function fetchShepayHeldTotal(shopId: string): Promise<number> {
  if (!shopId) return 0
  const { data, error } = await supabase
    .from('shepay_pending_settlements')
    .select('amount')
    .eq('shop_id', shopId)
    .in('status', ['pending', 'failed'])

  if (error || !data?.length) return 0
  return data.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
}
