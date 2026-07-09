import './setup-polyfill'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

import type { Database } from './database.types'
import { supabaseConfig } from './env'

export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  Platform.OS === 'web'
    ? undefined
    : {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      },
)
