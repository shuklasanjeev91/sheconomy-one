import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePathname } from 'one'
import { useEffect, useMemo, useRef } from 'react'
import { Platform } from 'react-native'

import { supabase, type Json } from '~/lib/supabase'
import { useSupabase } from '~/providers/SupabaseProvider'

const SESSION_KEY = 'sheconomy:analytics-session'
const DEVICE_KEY = 'sheconomy:analytics-device'
const HEARTBEAT_MS = 45_000

async function getStableId(key: string, prefix: string) {
  const existing = await AsyncStorage.getItem(key)
  if (existing) return existing

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  await AsyncStorage.setItem(key, id)
  return id
}

function getPageName(pathname: string) {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first) return 'home'
  if (first === 'admin' && second) return `admin:${second}`
  if (first === 'admin') return 'admin:dashboard'
  return first
}

export function AppUsageTracker() {
  const pathname = usePathname()
  const { user, isLoading } = useSupabase()
  const presenceIdRef = useRef<string | null>(null)

  const page = useMemo(() => getPageName(pathname), [pathname])

  useEffect(() => {
    if (isLoading) return

    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function writePresence(createNewRow: boolean) {
      const [sessionId, deviceId] = await Promise.all([
        getStableId(SESSION_KEY, 'session'),
        getStableId(DEVICE_KEY, 'device'),
      ])

      if (!active) return

      const now = new Date().toISOString()
      const payload = {
        actor_id: user?.id ?? null,
        device_id: deviceId,
        is_guest: !user,
        joined_at: createNewRow ? now : undefined,
        last_seen: now,
        page,
        path: pathname,
        query: {
          platform: Platform.OS,
          tracked_by: 'AppUsageTracker',
        } as Json,
        session_id: sessionId,
        user_id: user?.id ?? null,
      }

      if (createNewRow || !presenceIdRef.current) {
        const { data } = await supabase.from('page_presence').insert(payload).select('id').maybeSingle()
        presenceIdRef.current = data?.id ?? null
        return
      }

      await supabase
        .from('page_presence')
        .update({
          actor_id: payload.actor_id,
          device_id: payload.device_id,
          is_guest: payload.is_guest,
          last_seen: payload.last_seen,
          page: payload.page,
          path: payload.path,
          query: payload.query,
          session_id: payload.session_id,
          user_id: payload.user_id,
        })
        .eq('id', presenceIdRef.current)

      if (user?.id) {
        await supabase.from('profiles').update({ is_online: true, last_seen: now }).eq('id', user.id)
      }
    }

    presenceIdRef.current = null
    void writePresence(true)
    timer = setInterval(() => {
      void writePresence(false)
    }, HEARTBEAT_MS)

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [isLoading, page, pathname, user?.id])

  return null
}
