import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '~/config/supabase-public'

type SupabaseEnvKey = 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'

function readEnv(key: SupabaseEnvKey): string {
  const candidates = [typeof process !== 'undefined' ? process.env[key] : undefined]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  if (key === 'EXPO_PUBLIC_SUPABASE_URL') return PUBLIC_SUPABASE_URL
  return PUBLIC_SUPABASE_ANON_KEY
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  projectId: 'zsaqrrzwygzwrlzgymxk',
  projectName: 'sheconomy_db',
} as const

export function assertSupabaseConfig(): void {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
    )
  }
}
