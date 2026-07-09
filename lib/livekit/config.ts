import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type LiveKitConfig = {
  enabled: boolean
  serverUrl: string | null
  maxParticipants: number
}

type LiveKitConfigResponse = {
  enabled?: boolean
  url?: string | null
  maxParticipants?: number
  error?: string
}

let cachedConfig: LiveKitConfig | null = null
let inflight: Promise<LiveKitConfig> | null = null

const DEFAULT_CONFIG: LiveKitConfig = {
  enabled: false,
  serverUrl: null,
  maxParticipants: 500,
}

/** Fetch public LiveKit config from sheconomy_db edge function (cached). */
export async function fetchLiveKitConfig(): Promise<LiveKitConfig> {
  if (cachedConfig) return cachedConfig
  if (inflight) return inflight

  if (!supabaseConfig.url) {
    return DEFAULT_CONFIG
  }

  inflight = (async () => {
    const { data, error } = await supabase.functions.invoke('livekit-config', { body: {} })

    if (error) {
      const message = error.message || ''
      // Fallback until livekit-config is deployed: token endpoint still provides URL.
      if (message.includes('404') || message.toLowerCase().includes('not found')) {
        const fallback: LiveKitConfig = { enabled: true, serverUrl: null, maxParticipants: 500 }
        cachedConfig = fallback
        return fallback
      }
      console.warn('[livekit] config fetch failed:', message)
      return DEFAULT_CONFIG
    }

    const payload = data as LiveKitConfigResponse
    if (payload.error) {
      console.warn('[livekit] config error:', payload.error)
      return DEFAULT_CONFIG
    }

    const config: LiveKitConfig = {
      enabled: !!payload.enabled && !!payload.url,
      serverUrl: payload.url ?? null,
      maxParticipants: payload.maxParticipants ?? 500,
    }

    cachedConfig = config
    return config
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function getCachedLiveKitConfig(): LiveKitConfig | null {
  return cachedConfig
}

export function isLiveKitConfigured(): boolean {
  return getCachedLiveKitConfig()?.enabled ?? false
}

export function getLiveKitRoomName(roomId: string): string {
  return roomId
}

export function clearLiveKitConfigCache(): void {
  cachedConfig = null
  inflight = null
}
