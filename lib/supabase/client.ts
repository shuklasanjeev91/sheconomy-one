import './setup-polyfill'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import type { Database } from './database.types'
import { supabaseConfig } from './env'

const authOptions = {
  flowType: 'pkce' as const,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  experimental: {
    passkey: true,
  },
}

export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  Platform.OS === 'web'
    ? { auth: authOptions }
    : {
        auth: {
          ...authOptions,
          storage: AsyncStorage,
        },
      },
)
