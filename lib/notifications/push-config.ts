/** Shared push config for web / iOS / Android clients. */
import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type PushPlatform = 'web' | 'ios' | 'android'

export type OneSignalConfig = {
  enabled: boolean
  appId: string | null
  safariWebId: string | null
}

type OneSignalConfigResponse = {
  enabled?: boolean
  appId?: string | null
  safariWebId?: string | null
  error?: string
}

let cachedConfig: OneSignalConfig | null = null
let inflight: Promise<OneSignalConfig> | null = null

const DEFAULT_CONFIG: OneSignalConfig = {
  enabled: false,
  appId: null,
  safariWebId: null,
}

/** Env fallback only — prefer `resolveOneSignalAppId()` which uses edge secrets. */
export function getOneSignalAppIdFromEnv(): string | null {
  const value =
    (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID : undefined) ??
    undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Synchronous App ID: cache → env.
 * Use while waiting for `fetchOneSignalConfig()`; prefer the async resolver for init.
 */
export function getOneSignalAppId(): string | null {
  return cachedConfig?.appId ?? getOneSignalAppIdFromEnv()
}

/** Fetch public OneSignal config from Supabase edge secrets (cached). */
export async function fetchOneSignalConfig(): Promise<OneSignalConfig> {
  if (cachedConfig?.enabled && cachedConfig.appId) return cachedConfig
  if (inflight) return inflight

  inflight = (async () => {
    const envAppId = getOneSignalAppIdFromEnv()

    if (!supabaseConfig.url) {
      const fallback: OneSignalConfig = {
        enabled: !!envAppId,
        appId: envAppId,
        safariWebId: null,
      }
      cachedConfig = fallback
      return fallback
    }

    try {
      const { data, error } = await supabase.functions.invoke('onesignal-config', { body: {} })

      if (!error && data) {
        const payload = data as OneSignalConfigResponse
        if (!payload.error) {
          const appId =
            (typeof payload.appId === 'string' && payload.appId.trim()) || envAppId || null
          const config: OneSignalConfig = {
            enabled: !!payload.enabled && !!appId,
            appId,
            safariWebId:
              typeof payload.safariWebId === 'string' && payload.safariWebId.trim()
                ? payload.safariWebId.trim()
                : null,
          }
          cachedConfig = config
          return config
        }
      }

      if (error) {
        console.warn('[push] onesignal-config fetch failed:', error.message)
      }
    } catch (error) {
      console.warn('[push] onesignal-config error', error)
    }

    // Fall back to baked-in env so local/dev still works if the function is down.
    const fallback: OneSignalConfig = {
      enabled: !!envAppId,
      appId: envAppId,
      safariWebId: null,
    }
    cachedConfig = fallback
    return fallback
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Resolve App ID from edge secrets (with env fallback). */
export async function resolveOneSignalAppId(): Promise<string | null> {
  const config = await fetchOneSignalConfig()
  return config.appId
}

export function clearOneSignalConfigCache(): void {
  cachedConfig = null
  inflight = null
}

export function resolvePushPlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return 'web'
}

/** Convert absolute/relative action URLs into in-app paths. */
export function pathFromNotificationUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed
  try {
    const parsed = new URL(trimmed)
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return trimmed.startsWith('sheconomy://')
      ? trimmed.replace(/^sheconomy:\/\//, '/')
      : null
  }
}
