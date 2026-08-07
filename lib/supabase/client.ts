import '~/lib/supabase/setup-polyfill'

import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import type { Database } from '~/lib/supabase/database.types'
import { supabaseConfig } from '~/lib/supabase/env'
import { getRealtimeTransport } from '~/lib/supabase/realtime-ws'
import { safeAuthStorage } from '~/lib/supabase/safe-auth-storage'

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
          storage: safeAuthStorage,
        },
        ...(realtime ? { realtime } : {}),
      },
)
