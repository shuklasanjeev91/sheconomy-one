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

  const { error } = await supabase.from('user_push_devices').upsert(
    {
      user_id: input.userId,
      player_id: playerId,
      platform: input.platform ?? 'web',
      provider: input.provider ?? 'onesignal',
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider,player_id' },
  )

  return { error: error?.message ?? null }
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
