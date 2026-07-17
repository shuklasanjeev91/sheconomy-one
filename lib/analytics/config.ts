/**
 * Analytics identifiers ported from the legacy SHEconomy web application.
 *
 * All public IDs can be overridden per environment. External analytics is
 * enabled in production, or explicitly in development with
 * EXPO_PUBLIC_ENABLE_EXTERNAL_ANALYTICS=true.
 */
export const ANALYTICS_CONFIG = {
  googleTagManagerId:
    process.env.EXPO_PUBLIC_GOOGLE_TAG_MANAGER_ID?.trim() || 'GTM-5Q46HTDR',
  googleAnalyticsId:
    process.env.EXPO_PUBLIC_GOOGLE_ANALYTICS_ID?.trim() || 'G-ZQWD6CCEPY',
  metaPixelId: process.env.EXPO_PUBLIC_META_PIXEL_ID?.trim() || '871397487664970',
  clarityProjectId:
    process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim() || 'vgpk0whxnd',
} as const

export const EXTERNAL_ANALYTICS_ENABLED =
  process.env.NODE_ENV === 'production' ||
  process.env.EXPO_PUBLIC_ENABLE_EXTERNAL_ANALYTICS === 'true'
