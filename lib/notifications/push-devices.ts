import { supabase } from '~/lib/supabase/client'

type RegisterPushDeviceInput = {
  userId: string
  playerId: string
  platform?: 'web' | 'ios' | 'android'
  provider?: string
}

/**
 * Persist a OneSignal (or compatible) player id so the notification dispatcher
 * can fan out push for abandoned cart / restock alerts.
 */
export async function registerPushDevice(
  input: RegisterPushDeviceInput,
): Promise<{ error: string | null }> {
  const playerId = input.playerId.trim()
  if (!playerId) return { error: 'Missing push device id' }

  const row = {
    user_id: input.userId,
    player_id: playerId,
    platform: input.platform ?? 'web',
    provider: input.provider ?? 'onesignal',
    enabled: true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_push_devices')
    .upsert(row, { onConflict: 'user_id,provider,player_id' })
    .select('id, platform, player_id')
    .maybeSingle()

  if (error) {
    // Fallback when upsert+select is blocked by RLS RETURNING quirks.
    const insert = await supabase.from('user_push_devices').insert(row).select('id').maybeSingle()
    if (!insert.error) return { error: null }

    const update = await supabase
      .from('user_push_devices')
      .update({
        platform: row.platform,
        enabled: true,
        updated_at: row.updated_at,
      })
      .eq('user_id', input.userId)
      .eq('provider', row.provider)
      .eq('player_id', playerId)
      .select('id')
      .maybeSingle()

    if (update.error || !update.data) {
      return { error: error.message || insert.error?.message || update.error?.message || 'Failed to save push device' }
    }
  }

  if (!data && !error) {
    // Upsert succeeded but RETURNING empty — verify with a follow-up read.
    const { data: existing, error: readError } = await supabase
      .from('user_push_devices')
      .select('id')
      .eq('user_id', input.userId)
      .eq('provider', row.provider)
      .eq('player_id', playerId)
      .eq('enabled', true)
      .maybeSingle()
    if (readError || !existing) {
      return { error: readError?.message || 'Push device was not saved' }
    }
  }

  return { error: null }
}

export async function disablePushDevice(
  userId: string,
  playerId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_push_devices')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('player_id', playerId)

  return { error: error?.message ?? null }
}
