import { supabase } from '~/lib/supabase/client'

/** Subscribe the signed-in user to a back-in-stock alert for a listing. */
export async function subscribeStockAlert(
  listingId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('listing_stock_alerts').upsert(
    {
      listing_id: listingId,
      user_id: userId,
      notified_at: null,
    },
    { onConflict: 'listing_id,user_id' },
  )
  return { error: error?.message ?? null }
}

export async function unsubscribeStockAlert(
  listingId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('listing_stock_alerts')
    .delete()
    .eq('listing_id', listingId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function isStockAlertSubscribed(
  listingId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('listing_stock_alerts')
    .select('id')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .is('notified_at', null)
    .maybeSingle()
  return !!data
}
