/** Shared cache keys for prefetch, SSR loaders, and client feed hooks. */
export const CACHE_KEYS = {
  home: 'route:home',
  categories: 'feed:categories:images-only-v1',
  shops: 'feed:shops',
  listingFeed: (kind: string) => `feed:listings:${kind}`,
  categoryListings: (categoryId: string) => `feed:category:${categoryId}`,
  community: 'feed:community',
  shopsBrowse: 'route:shops-browse',
  classesVideo: 'route:classes:video',
  classesAudio: 'route:classes:audio',
  chatList: (userId: string) => `chat:list:${userId}`,
  coWorkMyMeetings: (userId: string) => `route:cowork:my-meetings:${userId}`,
  coWorkUpcoming: 'route:cowork:upcoming',
  notifications: (userId: string) => `route:notifications:${userId}`,
} as const
