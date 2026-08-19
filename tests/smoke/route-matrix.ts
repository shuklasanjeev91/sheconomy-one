/**
 * Route matrices for Playwright smoke.
 * Paths are load-tested; tier specs assert access semantics.
 */

/** Guest-safe / semi-public — must not 500 (redirect / empty shell / sign-in ok). */
export const guestPublicRoutes = [
  // Commerce / storefront
  '/',
  '/search',
  '/shops',
  '/browse/physical',
  '/browse/digital',
  '/browse/featured',
  '/browse/trending',
  '/browse/latest',
  '/cart',
  '/checkout',
  '/favorites',
  '/orders',
  '/orders/success',
  '/addresses',
  '/payment-methods',
  '/create-my-shop',
  // Auth
  '/auth/sign-in',
  '/auth/complete-profile',
  '/auth/verify-gender',
  '/auth/import-contacts',
  '/auth/qr',
  // Community
  '/community',
  '/community/network',
  '/community/people',
  '/community/create',
  '/community/jobs',
  '/community/jobs/create',
  '/community/stories',
  '/community/stories/create',
  '/community/companies',
  '/community/company/create',
  '/community/groups',
  '/community/group/create',
  '/community/events',
  '/community/events/create',
  '/community/saved',
  '/community/analytics',
  // Chat
  '/chat',
  '/chat/groups',
  '/chat/calls',
  // Class
  '/class',
  '/class/video',
  '/class/audio',
  '/class/playlists',
  // Co-work
  '/co-work',
  '/co-work/join',
  '/co-work/meetings',
  '/co-work/schedule',
  // Account / settings / legal / help
  '/profile',
  '/notifications',
  '/settings',
  '/settings/account',
  '/settings/appearance',
  '/settings/privacy',
  '/settings/security',
  '/settings/notifications',
  '/settings/commerce',
  '/settings/community',
  '/settings/chat',
  '/settings/class',
  '/settings/co-work',
  '/settings/shop',
  '/settings/about',
  '/help',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/ads',
  // Marketing / CMS
  '/blog',
  '/sellerlanding',
  // Vendor hub (auth-gated — must not 500)
  '/vendor',
  '/vendor/myshop',
  '/vendor/products',
  '/vendor/orders',
  '/vendor/settings',
] as const

/** Signed-in member surfaces (orders, account, checkout). */
export const authRequiredRoutes = [
  '/orders',
  '/checkout',
  '/addresses',
  '/payment-methods',
  '/settings',
  '/settings/account',
  '/settings/appearance',
  '/settings/privacy',
  '/profile',
  '/notifications',
] as const

/** Women-first / human-verification surfaces. */
export const genderGatedRoutes = [
  '/community',
  '/chat',
  '/create-my-shop',
  '/notifications',
  '/settings',
  '/profile',
] as const

/** Vendor console — verified vendor role. */
export const vendorRoutes = [
  '/vendor',
  '/vendor/myshop',
  '/vendor/products',
  '/vendor/orders',
  '/vendor/settings',
] as const

/** Subset for mobile guest matrix (keep CI time bounded). */
export const guestMobileRoutes = [
  '/',
  '/shops',
  '/search',
  '/cart',
  '/community',
  '/chat',
  '/class',
  '/co-work',
  '/auth/sign-in',
  '/help',
  '/sellerlanding',
  '/blog',
] as const
