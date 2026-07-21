import './setup-polyfill'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import type { Database } from './database.types'
import { supabaseConfig } from './env'
import { getRealtimeTransport } from './realtime-ws'

const authOptions = {
  flowType: 'pkce' as const,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  experimental: {
    passkey: true,
  },
}

const transport = getRealtimeTransport()
const realtime = transport ? { transport } : undefined

export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  Platform.OS === 'web'
    ? {
        auth: authOptions,
        ...(realtime ? { realtime } : {}),
      }
    : {
        auth: {
          ...authOptions,
          storage: AsyncStorage,
        },
        ...(realtime ? { realtime } : {}),
      },
)
