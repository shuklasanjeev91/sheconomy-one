/**
 * Route-wise SEO/Open Graph metadata.
 *
 * `resolveRouteSeo` maps a pathname to default metadata for every route in
 * `app/`. Screens with richer data (listing, shop, post, profile, …) override
 * these defaults at runtime via `usePageSeo`.
 */

export const SITE_NAME = 'SHEconomy'

export const DEFAULT_DESCRIPTION =
  'SHEconomy is a women-first marketplace and community: shop from women-led businesses, join groups and events, find jobs, learn with classes, and grow together.'

export const DEFAULT_OG_IMAGE = '/app-icon.png'

export type PageSeo = {
  /** Page title without the site suffix. */
  title: string
  description?: string
  /** Absolute or root-relative image URL for og:image / twitter:image. */
  image?: string | null
  type?: 'website' | 'article' | 'product' | 'profile'
  /** Private/utility pages that search engines should not index. */
  noindex?: boolean
  /** Overrides the canonical path (defaults to the current pathname). */
  canonicalPath?: string
}

export function buildPageTitle(title?: string | null) {
  const trimmed = title?.trim()
  if (!trimmed) return SITE_NAME
  // Avoid "SHEconomy — … | SHEconomy" on pages that already brand themselves.
  if (trimmed.startsWith(SITE_NAME)) return trimmed
  return `${trimmed} | ${SITE_NAME}`
}

type RouteRule = {
  /** Matches when the pathname equals `path` or starts with `path + '/'`. */
  path: string
  seo: PageSeo
}

const HOME_SEO: PageSeo = {
  title: `${SITE_NAME} — Marketplace & Community for Women`,
  description: DEFAULT_DESCRIPTION,
}

/**
 * Ordered longest-prefix-wins rules. Every route group in `app/` should have
 * an entry; dynamic detail screens refine these with live data.
 */
const ROUTE_RULES: RouteRule[] = [
  // ---- Store ----
  {
    path: '/browse',
    seo: {
      title: 'Browse Products',
      description: 'Discover products, services, and digital goods from women-led shops on SHEconomy.',
    },
  },
  {
    path: '/category',
    seo: {
      title: 'Shop by Category',
      description: 'Explore SHEconomy categories and find products from women entrepreneurs.',
    },
  },
  {
    path: '/listing',
    seo: {
      title: 'Product',
      description: 'View product details, reviews, and delivery options on SHEconomy.',
      type: 'product',
    },
  },
  {
    path: '/shops',
    seo: {
      title: 'Discover Shops',
      description: 'Browse women-led shops and boutiques on SHEconomy.',
    },
  },
  {
    path: '/shop',
    seo: {
      title: 'Shop',
      description: 'Visit this women-led shop on SHEconomy to browse its products and reviews.',
    },
  },
  {
    path: '/search',
    seo: {
      title: 'Search',
      description: 'Search products, shops, people, jobs, and more across SHEconomy.',
    },
  },
  { path: '/cart', seo: { title: 'Your Cart', noindex: true } },
  { path: '/checkout', seo: { title: 'Checkout', noindex: true } },
  { path: '/favorites', seo: { title: 'Favorites', noindex: true } },
  { path: '/orders', seo: { title: 'Your Orders', noindex: true } },
  { path: '/orders/success', seo: { title: 'Order Confirmed', noindex: true } },
  { path: '/orders/', seo: { title: 'Order Details', noindex: true } },
  { path: '/addresses', seo: { title: 'Saved Addresses', noindex: true } },
  { path: '/payment-methods', seo: { title: 'Payment Methods', noindex: true } },
  {
    path: '/create-my-shop',
    seo: {
      title: 'Create Your Shop',
      description: 'Start selling on SHEconomy — set up your women-led shop in minutes.',
    },
  },

  // ---- Community ----
  {
    path: '/community',
    seo: {
      title: 'Community',
      description: 'Connect with women entrepreneurs: posts, groups, events, jobs, and companies on SHEconomy.',
    },
  },
  { path: '/community/post', seo: { title: 'Post', type: 'article' } },
  { path: '/community/article', seo: { title: 'Article', type: 'article' } },
  {
    path: '/community/events',
    seo: {
      title: 'Events',
      description: 'Discover and join events hosted by the SHEconomy community.',
    },
  },
  {
    path: '/community/groups',
    seo: {
      title: 'Groups',
      description: 'Join interest groups and communities of women entrepreneurs on SHEconomy.',
    },
  },
  { path: '/community/group', seo: { title: 'Group' } },
  {
    path: '/community/jobs',
    seo: {
      title: 'Jobs',
      description: 'Find jobs and opportunities shared by the SHEconomy community.',
    },
  },
  {
    path: '/community/companies',
    seo: {
      title: 'Companies',
      description: 'Explore company pages from women-led businesses on SHEconomy.',
    },
  },
  { path: '/community/company', seo: { title: 'Company' } },
  {
    path: '/community/people',
    seo: {
      title: 'People',
      description: 'Find and connect with women entrepreneurs on SHEconomy.',
    },
  },
  { path: '/community/hashtag', seo: { title: 'Hashtag' } },
  { path: '/community/stories', seo: { title: 'Stories' } },
  { path: '/community/network', seo: { title: 'Your Network', noindex: true } },
  { path: '/community/saved', seo: { title: 'Saved Posts', noindex: true } },
  { path: '/community/create', seo: { title: 'Create Post', noindex: true } },
  { path: '/community/analytics', seo: { title: 'Community Analytics', noindex: true } },

  // ---- Chat ----
  { path: '/chat', seo: { title: 'Chat', noindex: true } },

  // ---- Class ----
  {
    path: '/class',
    seo: {
      title: 'Classes',
      description: 'Watch recorded videos and listen to audio on SHEconomy Class — browse, play, and continue watching.',
    },
  },
  { path: '/class/audio', seo: { title: 'Audio Classes' } },
  { path: '/class/video', seo: { title: 'Video Classes' } },
  { path: '/class/playlists', seo: { title: 'Playlists' } },

  // ---- Co-work ----
  {
    path: '/co-work',
    seo: {
      title: 'Co-work',
      description: 'Host and join meetings, co-working sessions, and calls on SHEconomy.',
    },
  },
  { path: '/co-work/meeting', seo: { title: 'Meeting', noindex: true } },
  { path: '/co-work/meetings', seo: { title: 'Your Meetings', noindex: true } },
  { path: '/co-work/join', seo: { title: 'Join Meeting', noindex: true } },
  { path: '/co-work/schedule', seo: { title: 'Schedule Meeting', noindex: true } },
  { path: '/co-work/recording', seo: { title: 'Meeting Recording', noindex: true } },

  // ---- Profile ----
  { path: '/profile', seo: { title: 'Profile', type: 'profile' } },

  // ---- Utility / account ----
  { path: '/notifications', seo: { title: 'Notifications', noindex: true } },
  { path: '/settings', seo: { title: 'Settings', noindex: true } },
  { path: '/auth', seo: { title: 'Sign In', noindex: true } },
  { path: '/auth/sign-up', seo: { title: 'Create Account', noindex: true } },
  { path: '/vendor', seo: { title: 'Vendor Hub', noindex: true } },
  { path: '/admin', seo: { title: 'Admin', noindex: true } },
  { path: '/ui-kit', seo: { title: 'UI Kit', noindex: true } },

  // ---- Help / legal ----
  {
    path: '/help',
    seo: {
      title: 'Help & Support',
      description: 'Get help with orders, shops, accounts, and everything SHEconomy.',
    },
  },
  { path: '/legal/terms', seo: { title: 'Terms of Service' } },
  { path: '/legal/privacy', seo: { title: 'Privacy Policy' } },
  { path: '/legal/cookies', seo: { title: 'Cookie Policy' } },
  { path: '/legal/ads', seo: { title: 'Advertising Policy' } },
]

// Longest prefix first so `/community/post` beats `/community`.
const SORTED_RULES = [...ROUTE_RULES].sort((a, b) => b.path.length - a.path.length)

export function resolveRouteSeo(pathname: string | null | undefined): PageSeo {
  const path = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/'

  if (path === '/') return HOME_SEO

  for (const rule of SORTED_RULES) {
    if (path === rule.path || path.startsWith(`${rule.path}/`)) {
      return rule.seo
    }
  }

  return HOME_SEO
}
