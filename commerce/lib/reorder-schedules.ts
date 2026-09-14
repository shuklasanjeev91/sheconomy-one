import { supabase } from '~/lib/supabase/client'
import type { Tables } from '~/lib/supabase'

export type ReorderCadence = 'weekly' | 'biweekly' | 'monthly'
export type ListingReorderSchedule = Tables<'listing_reorder_schedules'>

function nextRunAt(cadence: ReorderCadence): string {
  const now = new Date()
  if (cadence === 'weekly') now.setDate(now.getDate() + 7)
  else if (cadence === 'biweekly') now.setDate(now.getDate() + 14)
  else now.setMonth(now.getMonth() + 1)
  return now.toISOString()
}

export async function fetchReorderSchedule(
  userId: string,
  listingId: string,
): Promise<ListingReorderSchedule | null> {
  const { data } = await supabase
    .from('listing_reorder_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()
  return data ?? null
}

export async function upsertReorderSchedule(input: {
  userId: string
  listingId: string
  variantId?: string | null
  quantity?: number
  cadence: ReorderCadence
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('listing_reorder_schedules').upsert(
    {
      user_id: input.userId,
      listing_id: input.listingId,
      variant_id: input.variantId ?? null,
      quantity: input.quantity ?? 1,
      cadence: input.cadence,
      next_run_at: nextRunAt(input.cadence),
      paused: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,listing_id,variant_id' },
  )
  return { error: error?.message ?? null }
}

export async function pauseReorderSchedule(id: string, paused: boolean): Promise<string | null> {
  const { error } = await supabase
    .from('listing_reorder_schedules')
    .update({ paused, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error?.message ?? null
}
