function readEnv(key: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY') {
  const fromImportMeta = import.meta.env[key]
  if (fromImportMeta) return fromImportMeta

  if (typeof process !== 'undefined' && process.env[key]) {
    return process.env[key]!
  }

  return ''
}

const supabaseUrl = readEnv('EXPO_PUBLIC_SUPABASE_URL')
const supabaseAnonKey = readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

export const supabaseConfig = {
  url: supabaseUrl ?? '',
  anonKey: supabaseAnonKey ?? '',
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
