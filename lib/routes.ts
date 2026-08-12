import type { Href } from 'one'

/** Routes shared across every section (auth, account, cart, alerts). */
export const appRoutes = {
  /** Single OTP entry — creates account on first verify (no separate sign-up). */
  signIn: '/auth/sign-in' as Href,
  signUp: '/auth/sign-in' as Href,
  importContacts: '/auth/import-contacts' as Href,
  completeProfile: '/auth/complete-profile' as Href,
  verifyGender: '/auth/verify-gender' as Href,
  notifications: '/notifications' as Href,
  profile: '/profile' as Href,
  userProfile: (handle: string) => `/profile/${encodeURIComponent(handle)}` as Href,
  settings: '/settings' as Href,
  settingsSection: (section: string) =>
    `/settings/${encodeURIComponent(section)}` as Href,
  help: '/help' as Href,
  helpProduct: (product: string) =>
    `/help?product=${encodeURIComponent(product)}` as Href,
  legalTerms: '/legal/terms' as Href,
  legalPrivacy: '/legal/privacy' as Href,
  legalCookies: '/legal/cookies' as Href,
  legalAds: '/legal/ads' as Href,
  cart: '/cart' as Href,
  checkout: '/checkout' as Href,
  /** Unified omnibox results — optional `scope`: all | listings | shops | people | …; `mode`: ai */
  search: (query?: string, scope?: string, mode?: 'ai' | null) => {
    const params = new URLSearchParams()
    if (query?.trim()) params.set('q', query.trim())
    if (scope && scope !== 'all') params.set('scope', scope)
    if (mode === 'ai') params.set('mode', 'ai')
    const search = params.toString()
    return (search ? `/search?${search}` : '/search') as Href
  },
} as const

/** Reserved prefixes — everything else is the commerce storefront. */
const NON_COMMERCE_PREFIXES = [
  '/community',
  '/chat',
  '/class',
  '/co-work',
  '/auth',
  '/ui-kit',
  '/notifications',
  '/profile',
  '/settings',
  '/help',
  '/legal',
  '/vendor',
  '/sellerlanding',
] as const

/** Public CMS blog — listing + article reader. */
export const blogRoutes = {
  home: '/blog' as Href,
  post: (slug: string) => `/blog/${encodeURIComponent(slug)}` as Href,
} as const

export const commerceRoutes = {
  home: '/' as Href,
  /** Guided multi-step seller onboarding for any signed-in member without a shop. */
  createShop: '/create-my-shop' as Href,
  /** Seller hub — vendor console (`/vendor/myshop`). */
  manageShop: (_shopId?: string) => '/vendor/myshop' as Href,
  shops: '/shops' as Href,
  cart: appRoutes.cart,
  checkout: appRoutes.checkout,
  favorites: '/favorites' as Href,
  wishlist: '/favorites' as Href,
  sharedWishlist: (token: string) => `/w/${encodeURIComponent(token)}` as Href,
  orders: '/orders' as Href,
  order: (id: string) => `/orders/${encodeURIComponent(id)}` as Href,
  orderSuccess: (orderIds?: string[]) => {
    if (!orderIds?.length) return '/orders/success' as Href
    const params = new URLSearchParams()
    params.set('ids', orderIds.join(','))
    return `/orders/success?${params.toString()}` as Href
  },
  paymentMethods: '/payment-methods' as Href,
  addresses: '/addresses' as Href,
  search: (query?: string, scope?: string) => appRoutes.search(query, scope ?? 'listings'),
  category: (slug: string) => `/category/${encodeURIComponent(slug)}` as Href,
  browse: (kind: string) => `/browse/${kind}` as Href,
  listing: (slug: string) => `/listing/${encodeURIComponent(slug)}` as Href,
  shop: (slug: string) => `/shop/${encodeURIComponent(slug)}` as Href,
  shopPrivacy: (slug: string) => `/shop/${encodeURIComponent(slug)}/privacy` as Href,
  shopTerms: (slug: string) => `/shop/${encodeURIComponent(slug)}/terms` as Href,
  shopReturns: (slug: string) => `/shop/${encodeURIComponent(slug)}/returns` as Href,
  shopRefunds: (slug: string) => `/shop/${encodeURIComponent(slug)}/refunds` as Href,
  shopShipping: (slug: string) => `/shop/${encodeURIComponent(slug)}/shipping` as Href,
  following: '/following' as Href,
} as const

/** Vendor console — a seller's own storefront management section. */
export const vendorRoutes = {
  home: '/vendor' as Href,
  myShop: '/vendor/myshop' as Href,
  /** "Edit Shop" opens the General tab of the shop Settings page. */
  editShop: '/vendor/settings?section=general' as Href,
  createListing: '/vendor/create-listing' as Href,
  editListing: (id: string) => `/vendor/create-listing?id=${encodeURIComponent(id)}` as Href,
  products: '/vendor/products' as Href,
  orders: '/vendor/orders' as Href,
  ordersSection: (section: string) =>
    `/vendor/orders?section=${encodeURIComponent(section)}` as Href,
  analytics: '/vendor/analytics' as Href,
  delivery: '/vendor/delivery' as Href,
  ads: '/vendor/ads' as Href,
  createDiscount: '/vendor/ads/create' as Href,
  reviews: '/vendor/reviews' as Href,
  settings: '/vendor/settings' as Href,
  settingsSection: (section: string) =>
    `/vendor/settings?section=${encodeURIComponent(section)}` as Href,
} as const

export const communityRoutes = {
  home: '/community' as Href,
  network: '/community/network' as Href,
  people: '/community/people' as Href,
  peopleTab: (tab: string) => `/community/people/${encodeURIComponent(tab)}` as Href,
  notifications: appRoutes.notifications,
  profile: appRoutes.profile,
  userProfile: appRoutes.userProfile,
  userFollowers: (handle: string) =>
    `/profile/${encodeURIComponent(handle)}/followers` as Href,
  userFollowing: (handle: string) =>
    `/profile/${encodeURIComponent(handle)}/following` as Href,
  userConnections: (handle: string) =>
    `/profile/${encodeURIComponent(handle)}/connections` as Href,
  settings: appRoutes.settings,
  createPost: '/community/create' as Href,
  post: (id: string) => `/community/post/${encodeURIComponent(id)}` as Href,
  article: (id: string) => `/community/article/${encodeURIComponent(id)}` as Href,
  jobs: '/community/jobs' as Href,
  jobCreate: '/community/jobs/create' as Href,
  job: (id: string) => `/community/jobs/${encodeURIComponent(id)}` as Href,
  hashtag: (tag: string) => `/community/hashtag/${encodeURIComponent(tag.replace(/^#/, ''))}` as Href,
  stories: '/community/stories' as Href,
  storyCreate: '/community/stories/create' as Href,
  storyUser: (userId: string) => `/community/stories/${encodeURIComponent(userId)}` as Href,
  companies: '/community/companies' as Href,
  company: (slug: string) => `/community/company/${encodeURIComponent(slug)}` as Href,
  companyCreate: '/community/company/create' as Href,
  groups: '/community/groups' as Href,
  group: (id: string) => `/community/group/${encodeURIComponent(id)}` as Href,
  groupCreate: '/community/group/create' as Href,
  events: '/community/events' as Href,
  eventCreate: '/community/events/create' as Href,
  event: (id: string) => `/community/events/${encodeURIComponent(id)}` as Href,
  saved: '/community/saved' as Href,
  analytics: '/community/analytics' as Href,
} as const

export const chatRoutes = {
  home: '/chat' as Href,
  groups: '/chat/groups' as Href,
  calls: '/chat/calls' as Href,
  conversation: (id: string) => `/chat/${encodeURIComponent(id)}` as Href,
  /** WhatsApp-style 1:1 LiveKit call (audio or video). */
  call: (code: string, options?: { type?: 'audio' | 'video'; callId?: string }) => {
    const params = new URLSearchParams()
    if (options?.type) params.set('type', options.type)
    if (options?.callId) params.set('callId', options.callId)
    const query = params.toString()
    return (
      query
        ? `/chat/call/${encodeURIComponent(code)}?${query}`
        : `/chat/call/${encodeURIComponent(code)}`
    ) as Href
  },
} as const

export const classRoutes = {
  home: '/class' as Href,
  video: '/class/video' as Href,
  audio: '/class/audio' as Href,
  playlists: '/class/playlists' as Href,
  playlist: (id: string) => `/class/playlists/${encodeURIComponent(id)}` as Href,
  program: (slug: string, options?: { playlist?: string }) => {
    const base = `/class/${encodeURIComponent(slug)}`
    if (options?.playlist) {
      return `${base}?playlist=${encodeURIComponent(options.playlist)}` as Href
    }
    return base as Href
  },
} as const

export const coWorkRoutes = {
  home: '/co-work' as Href,
  meeting: (code: string) => `/co-work/meeting/${encodeURIComponent(code)}` as Href,
  // Prefer nested `/live` — keeps LiveKit out of the lobby route chunk.
  // Flat `?live=1` used to share a file with lobby and blanked Co-Work/lobby.
  meetingLive: (code: string) =>
    `/co-work/meeting/${encodeURIComponent(code)}/live` as Href,
  recording: (token: string) => `/co-work/recording/${encodeURIComponent(token)}` as Href,
  schedule: '/co-work/schedule' as Href,
  meetings: '/co-work/meetings' as Href,
  join: '/co-work/join' as Href,
} as const

/** Shared auth + legacy aliases used across the app. */
export const routes = {
  root: '/' as Href,
  signIn: appRoutes.signIn,
  signUp: appRoutes.signUp,
  verifyGender: appRoutes.verifyGender,
  commerce: commerceRoutes,
  blog: blogRoutes,
  vendor: vendorRoutes,
  community: communityRoutes,
  chat: chatRoutes,
  class: classRoutes,
  coWork: coWorkRoutes,
  app: appRoutes,
  home: commerceRoutes.home,
  createShop: commerceRoutes.createShop,
  manageShop: commerceRoutes.manageShop,
  profile: appRoutes.profile,
  userProfile: appRoutes.userProfile,
  settings: appRoutes.settings,
  settingsSection: appRoutes.settingsSection,
  help: appRoutes.help,
  notifications: appRoutes.notifications,
  cart: appRoutes.cart,
  checkout: appRoutes.checkout,
  uiKit: '/ui-kit' as Href,
  listing: commerceRoutes.listing,
  shop: commerceRoutes.shop,
} as const

export function isCommercePath(pathname: string) {
  if (pathname === '/') return true
  return !NON_COMMERCE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isCommerceShopsPath(pathname: string) {
  return pathname === '/shops' || pathname.startsWith('/shop/')
}

export function isCommerceFavoritesPath(pathname: string) {
  return pathname === '/favorites' || pathname.startsWith('/favorites/')
}

export function isCommerceBuyerAccountPath(pathname: string) {
  return (
    pathname === '/orders' ||
    pathname.startsWith('/orders/') ||
    pathname === '/payment-methods' ||
    pathname.startsWith('/payment-methods/') ||
    pathname === '/addresses' ||
    pathname.startsWith('/addresses/')
  )
}

/** Commerce marketplace home — excludes routes owned by other bottom tabs. */
export function isCommerceHomePath(pathname: string) {
  return (
    isCommercePath(pathname) &&
    !isCartPath(pathname) &&
    !isCommerceShopsPath(pathname) &&
    !isCommerceFavoritesPath(pathname) &&
    !isCommerceBuyerAccountPath(pathname) &&
    !isVendorPath(pathname) &&
    pathname !== '/create-my-shop' &&
    !pathname.startsWith('/create-my-shop/')
  )
}

export function isCommunityPath(pathname: string) {
  return pathname === '/community' || pathname.startsWith('/community/')
}

export function isCommunityFeedPath(pathname: string) {
  // Home tab: the feed and feed-adjacent pages only. Network, Create Post and
  // Jobs have their own bottom tabs, so they must NOT match here (otherwise
  // Home would light up alongside them).
  return (
    pathname === '/community' ||
    pathname.startsWith('/community/post/') ||
    pathname === '/community/stories' ||
    pathname.startsWith('/community/stories/')
  )
}

export function isChatPath(pathname: string) {
  return pathname === '/chat' || pathname.startsWith('/chat/')
}

/** Group-chats view (`/chat/groups`). */
export function isChatGroupsPath(pathname: string) {
  return pathname === '/chat/groups'
}

/** Call-history view (`/chat/calls`). */
export function isChatCallsPath(pathname: string) {
  return pathname === '/chat/calls'
}

/** Active 1:1 LiveKit call (`/chat/call/{code}`). */
export function isChatCallPath(pathname: string) {
  return pathname === '/chat/call' || pathname.startsWith('/chat/call/')
}

/** A specific conversation thread (`/chat/{id}`) — rendered full-screen on mobile. */
export function isChatConversationPath(pathname: string) {
  return (
    /^\/chat\/[^/]+/.test(pathname) &&
    !isChatGroupsPath(pathname) &&
    !isChatCallsPath(pathname) &&
    !isChatCallPath(pathname)
  )
}

export function isClassPath(pathname: string) {
  return pathname === '/class' || pathname.startsWith('/class/')
}

export function isClassAudioPath(pathname: string) {
  return pathname === '/class/audio' || pathname.startsWith('/class/audio/')
}

export function isClassVideoPath(pathname: string) {
  return pathname === '/class/video' || pathname.startsWith('/class/video/')
}

export function isClassPlaylistsPath(pathname: string) {
  return pathname === '/class/playlists' || pathname.startsWith('/class/playlists/')
}

/** Class home tab — `/class` hub and program detail pages (not Video/Audio/Playlist lists). */
export function isClassHomePath(pathname: string) {
  if (!isClassPath(pathname)) return false
  if (isClassAudioPath(pathname) || isClassVideoPath(pathname) || isClassPlaylistsPath(pathname)) {
    return false
  }
  return true
}

/** @deprecated Prefer isClassVideoPath — kept for older call sites. */
export function isClassVideoHomePath(pathname: string) {
  return isClassVideoPath(pathname) || pathname === '/class' || pathname === '/class/'
}

export function isClassProgramPath(pathname: string) {
  if (!pathname.startsWith('/class/')) return false
  if (isClassAudioPath(pathname) || isClassVideoPath(pathname) || isClassPlaylistsPath(pathname)) {
    return false
  }
  return true
}

export function isCoWorkPath(pathname: string) {
  return pathname === '/co-work' || pathname.startsWith('/co-work/')
}

export function isCoWorkHomePath(pathname: string) {
  return pathname === '/co-work' || pathname === '/co-work/'
}

export function isCoWorkSchedulePath(pathname: string) {
  return pathname === '/co-work/schedule' || pathname.startsWith('/co-work/schedule/')
}

export function isCoWorkMeetingsPath(pathname: string) {
  return pathname === '/co-work/meetings' || pathname.startsWith('/co-work/meetings/')
}

export function isCoWorkJoinPath(pathname: string) {
  return pathname === '/co-work/join' || pathname.startsWith('/co-work/join/')
}

export function isCoWorkLivePath(pathname: string, search = '') {
  if (/\/co-work\/meeting\/[^/]+\/live\/?$/.test(pathname)) return true
  if (!/\/co-work\/meeting\/[^/]+\/?$/.test(pathname)) return false
  const query = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(query)
  const live = (params.get('live') ?? '').toLowerCase()
  return live === '1' || live === 'true' || live === 'yes'
}

export function isCreatePostPath(pathname: string) {
  return pathname === '/community/create' || pathname.startsWith('/community/create/')
}

export function isJobsPath(pathname: string) {
  return pathname === '/community/jobs' || pathname.startsWith('/community/jobs/')
}

export function isNotificationsPath(pathname: string) {
  return pathname === '/notifications' || pathname.startsWith('/notifications/')
}

export function isAccountPath(pathname: string) {
  return (
    pathname === appRoutes.profile ||
    pathname.startsWith(`${appRoutes.profile}/`) ||
    pathname === appRoutes.settings ||
    pathname.startsWith(`${appRoutes.settings}/`) ||
    pathname === appRoutes.help ||
    pathname.startsWith(`${appRoutes.help}/`) ||
    pathname.startsWith('/auth/')
  )
}

export function isHelpPath(pathname: string) {
  return pathname === appRoutes.help || pathname.startsWith(`${appRoutes.help}/`)
}

export function isHomePath(pathname: string) {
  return pathname === '/' || pathname === '/community'
}

/** Seller hub — vendor console (`/vendor/*`). */
export function isManageShopPath(pathname: string) {
  return isVendorPath(pathname)
}

export function isVendorPath(pathname: string) {
  return pathname === '/vendor' || pathname.startsWith('/vendor/')
}

export function isCreateShopPath(pathname: string) {
  return pathname === '/create-my-shop' || pathname.startsWith('/create-my-shop/')
}

/** Admin console (`/admin/*`) — renders its own chrome, no storefront footer. */
export function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function isProfilePath(pathname: string) {
  return isAccountPath(pathname)
}

export function isCartPath(pathname: string) {
  return (
    pathname === appRoutes.cart ||
    pathname.startsWith(`${appRoutes.cart}/`) ||
    pathname === appRoutes.checkout ||
    pathname.startsWith(`${appRoutes.checkout}/`)
  )
}
