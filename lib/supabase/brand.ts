import { supabase } from './client'

export const SHECONOMY_LOGO_BUCKET = 'sheconomy-logo' as const

const LOGO_PATHS = {
  /** Full wordmark — latest brand asset */
  primary: 'sheconomy-logo_v2.png',
  /** Square icon for compact nav */
  icon: '80x80.png',
} as const

export type SheconomyLogoVariant = keyof typeof LOGO_PATHS

export function getSheconomyLogoUrl(variant: SheconomyLogoVariant = 'primary') {
  const path = LOGO_PATHS[variant]
  const { data } = supabase.storage.from(SHECONOMY_LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Square brand mark for favicons and app icons */
export function getSheconomyFaviconUrl() {
  return getSheconomyLogoUrl('icon')
}
