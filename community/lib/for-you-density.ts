/**
 * Pure ranking helpers for Community "For you" density.
 * Keeps hard-priority action strips in the first visible set when they have content.
 */

export const FOR_YOU_VISIBLE_CAP = 5

/** Slot ids used by CommunityFeedHeader / ForYouSlot wrappers. */
export const FOR_YOU_SLOT = {
  celebrations: 'celebrations',
  profileCompletion: 'profile-completion',
  composeDraft: 'compose-draft',
  networkInvitations: 'network-invitations',
  networkSent: 'network-sent',
  unreadChat: 'unread-chat',
  networkSuggestions: 'network-suggestions',
  introductionInbox: 'introduction-inbox',
  introductionSent: 'introduction-sent',
  recommendationInbox: 'recommendation-inbox',
  recommendationSent: 'recommendation-sent',
  profileViewers: 'profile-viewers',
  meetingInvites: 'meeting-invites',
  meetingRevisit: 'meeting-revisit',
  groups: 'groups',
  companies: 'companies',
  programs: 'programs',
  pickUpAgain: 'pick-up-again',
  readLater: 'read-later',
  savedNotes: 'saved-notes',
  savedCollection: 'saved-collection',
  events: 'events',
  jobs: 'jobs',
  openToWork: 'open-to-work',
  openToServices: 'open-to-services',
  jobApplications: 'job-applications',
  professionalSpotlight: 'professional-spotlight',
  creatorMode: 'creator-mode',
  creatorSpotlight: 'creator-spotlight',
  followedShopActivity: 'followed-shop-activity',
  shoppablePostsSpotlight: 'shoppable-posts-spotlight',
  wishlistActivity: 'wishlist-activity',
  recentlyViewed: 'recently-viewed',
  hashtags: 'hashtags',
} as const

export type ForYouSlotId = (typeof FOR_YOU_SLOT)[keyof typeof FOR_YOU_SLOT]

/**
 * Lower number = higher priority. Hard-priority action strips sit at the top
 * so invites / unread chat never fall behind soft revisits.
 */
export const FOR_YOU_SLOT_PRIORITY: Record<ForYouSlotId, number> = {
  [FOR_YOU_SLOT.networkInvitations]: 10,
  [FOR_YOU_SLOT.unreadChat]: 20,
  [FOR_YOU_SLOT.meetingInvites]: 30,
  [FOR_YOU_SLOT.composeDraft]: 40,
  [FOR_YOU_SLOT.celebrations]: 50,
  [FOR_YOU_SLOT.profileCompletion]: 60,
  [FOR_YOU_SLOT.introductionInbox]: 70,
  [FOR_YOU_SLOT.recommendationInbox]: 80,
  [FOR_YOU_SLOT.networkSuggestions]: 90,
  [FOR_YOU_SLOT.networkSent]: 100,
  [FOR_YOU_SLOT.introductionSent]: 110,
  [FOR_YOU_SLOT.recommendationSent]: 120,
  [FOR_YOU_SLOT.profileViewers]: 130,
  [FOR_YOU_SLOT.meetingRevisit]: 140,
  [FOR_YOU_SLOT.jobApplications]: 150,
  [FOR_YOU_SLOT.jobs]: 160,
  [FOR_YOU_SLOT.events]: 170,
  [FOR_YOU_SLOT.groups]: 180,
  [FOR_YOU_SLOT.companies]: 190,
  [FOR_YOU_SLOT.programs]: 200,
  [FOR_YOU_SLOT.openToWork]: 210,
  [FOR_YOU_SLOT.openToServices]: 220,
  [FOR_YOU_SLOT.pickUpAgain]: 230,
  [FOR_YOU_SLOT.readLater]: 240,
  [FOR_YOU_SLOT.savedNotes]: 250,
  [FOR_YOU_SLOT.savedCollection]: 260,
  [FOR_YOU_SLOT.professionalSpotlight]: 270,
  [FOR_YOU_SLOT.creatorMode]: 280,
  [FOR_YOU_SLOT.creatorSpotlight]: 290,
  [FOR_YOU_SLOT.followedShopActivity]: 300,
  [FOR_YOU_SLOT.shoppablePostsSpotlight]: 305,
  [FOR_YOU_SLOT.wishlistActivity]: 310,
  [FOR_YOU_SLOT.recentlyViewed]: 320,
  [FOR_YOU_SLOT.hashtags]: 330,
}

/** Always stay inside the first visible window when they have content. */
export const FOR_YOU_HARD_PRIORITY_IDS: ReadonlySet<ForYouSlotId> = new Set([
  FOR_YOU_SLOT.networkInvitations,
  FOR_YOU_SLOT.unreadChat,
  FOR_YOU_SLOT.meetingInvites,
])

export type ForYouSlotState = {
  id: ForYouSlotId
  hasContent: boolean
}

export type ForYouDensityResult = {
  /** Slot ids to show in the primary (above See all) set. */
  visibleIds: ForYouSlotId[]
  /** Slot ids with content that sit behind See all. */
  overflowIds: ForYouSlotId[]
  /** All ids currently reporting content, priority-sorted. */
  contentIds: ForYouSlotId[]
}

function priorityOf(id: ForYouSlotId): number {
  return FOR_YOU_SLOT_PRIORITY[id] ?? Number.MAX_SAFE_INTEGER
}

/**
 * Rank slots that have content. Hard-priority slots with content always occupy
 * the first visible slots (up to the cap); remaining slots fill by priority.
 */
export function selectVisibleForYouSlots(
  slots: readonly ForYouSlotState[],
  options?: { maxVisible?: number; hardPriorityIds?: ReadonlySet<ForYouSlotId> },
): ForYouDensityResult {
  const maxVisible = options?.maxVisible ?? FOR_YOU_VISIBLE_CAP
  const hardPriorityIds = options?.hardPriorityIds ?? FOR_YOU_HARD_PRIORITY_IDS

  const withContent = slots
    .filter((slot) => slot.hasContent)
    .map((slot) => slot.id)
    .sort((a, b) => priorityOf(a) - priorityOf(b))

  const hard = withContent.filter((id) => hardPriorityIds.has(id))
  const soft = withContent.filter((id) => !hardPriorityIds.has(id))

  const visibleHard = hard.slice(0, maxVisible)
  const remaining = Math.max(0, maxVisible - visibleHard.length)
  const visibleSoft = soft.slice(0, remaining)
  const visibleIds = [...visibleHard, ...visibleSoft]

  const visibleSet = new Set(visibleIds)
  const overflowIds = withContent.filter((id) => !visibleSet.has(id))

  return {
    visibleIds,
    overflowIds,
    contentIds: withContent,
  }
}

export function forYouSlotPriority(id: ForYouSlotId): number {
  return priorityOf(id)
}
