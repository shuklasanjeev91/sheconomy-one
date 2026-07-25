/** Official product name — always "SHEconomy" in user-facing copy. */
export const BRAND_NAME = 'SHEconomy' as const

export const BRAND_MEMBER_LABEL = `${BRAND_NAME} member` as const
export const BRAND_SHOP_LABEL = `${BRAND_NAME} shop` as const
export const BRAND_COWORK_LABEL = `${BRAND_NAME} Co-Work` as const

/** Official square logo (1024×1024) — app icon + splash source. */
export const BRAND_LOGO_URL =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/1024X1024.png' as const

/** Public social profiles — footer and marketing surfaces. */
export const BRAND_SOCIAL = {
  instagram: 'https://www.instagram.com/',
  twitter: 'https://twitter.com/',
} as const
