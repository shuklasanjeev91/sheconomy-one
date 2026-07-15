import type { Href } from 'one'

/** Routes shared across every section (auth, account, cart, alerts). */
export const appRoutes = {
  /** Single OTP entry — creates account on first verify (no separate sign-up). */
  signIn: '/auth/sign-in' as Href,
  signUp: '/auth/sign-in' as Href,
  importContacts: '/auth/import-contacts' as Href,
  verifyGender: '/auth/verify-gender' as Href,
  notifications: '/notifications' as Href,
  profile: '/profile' as Href,
  userProfile: (handle: string) => `/profile/${encodeURIComponent(handle)}` as Href,
  settings: '/settings' as Href,
  help: '/help' as Href,
  helpProduct: (product: string) =>
    `/help?product=${encodeURIComponent(product)}` as Href,
  cart: '/cart' as Href,
  checkout: '/checkout' as Href,
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
  '/vendor',
] as const

export const commerceRoutes = {
  home: '/' as Href,
  myShops: '/my-shops' as Href,
  /** Guided multi-step seller onboarding for any signed-in member without a shop. */
  createShop: '/create-my-shop' as Href,
  manageShop: (shopId: string) => `/my-shops/${encodeURIComponent(shopId)}` as Href,
  shops: '/shops' as Href,
  cart: appRoutes.cart,
  checkout: appRoutes.checkout,
  favorites: '/favorites' as Href,
  wishlist: '/favorites' as Href,
  orders: '/orders' as Href,
  paymentMethods: '/payment-methods' as Href,
  addresses: '/addresses' as Href,
  search: (query?: string) =>
    (query ? `/search?q=${encodeURIComponent(query)}` : '/search') as Href,
  category: (slug: string) => `/category/${encodeURIComponent(slug)}` as Href,
  browse: (kind: string) => `/browse/${kind}` as Href,
  listing: (slug: string) => `/listing/${encodeURIComponent(slug)}` as Href,
  shop: (slug: string) => `/shop/${encodeURIComponent(slug)}` as Href,
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
  analytics: '/vendor/analytics' as Href,
  delivery: '/vendor/delivery' as Href,
  ads: '/vendor/ads' as Href,
  reviews: '/vendor/reviews' as Href,
  settings: '/vendor/settings' as Href,
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
} as const

export const classRoutes = {
  home: '/class' as Href,
  video: '/class' as Href,
  audio: '/class/audio' as Href,
  program: (slug: string) => `/class/${encodeURIComponent(slug)}` as Href,
} as const

export const coWorkRoutes = {
  home: '/co-work' as Href,
  meeting: (code: string) => `/co-work/meeting/${encodeURIComponent(code)}` as Href,
  meetingLive: (code: string) => `/co-work/meeting/${encodeURIComponent(code)}/live` as Href,
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
  vendor: vendorRoutes,
  community: communityRoutes,
  chat: chatRoutes,
  class: classRoutes,
  coWork: coWorkRoutes,
  app: appRoutes,
  home: commerceRoutes.home,
  myShops: commerceRoutes.myShops,
  profile: appRoutes.profile,
  userProfile: appRoutes.userProfile,
  settings: appRoutes.settings,
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
    !isMyShopsPath(pathname)
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

/** A specific conversation thread (`/chat/{id}`) — rendered full-screen on mobile. */
export function isChatConversationPath(pathname: string) {
  return (
    /^\/chat\/[^/]+/.test(pathname) &&
    !isChatGroupsPath(pathname) &&
    !isChatCallsPath(pathname)
  )
}

export function isClassPath(pathname: string) {
  return pathname === '/class' || pathname.startsWith('/class/')
}

export function isClassAudioPath(pathname: string) {
  return pathname === '/class/audio' || pathname.startsWith('/class/audio/')
}

export function isClassVideoHomePath(pathname: string) {
  return pathname === '/class' || pathname === '/class/'
}

export function isClassProgramPath(pathname: string) {
  if (!pathname.startsWith('/class/')) return false
  if (isClassAudioPath(pathname)) return false
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

export function isCoWorkLivePath(pathname: string) {
  return /\/co-work\/meeting\/[^/]+\/live/.test(pathname)
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

export function isMyShopsPath(pathname: string) {
  return pathname === '/my-shops' || pathname.startsWith('/my-shops/')
}

export function isVendorPath(pathname: string) {
  return pathname === '/vendor' || pathname.startsWith('/vendor/')
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
