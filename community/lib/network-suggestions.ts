import type { NetworkMember } from '~/community/lib/network'

export function filterNetworkSuggestions(
  members: NetworkMember[],
  dismissedIds: string[],
  limit = 4,
): NetworkMember[] {
  return rankNetworkSuggestions(members, { dismissedIds, limit })
}

export function rankNetworkSuggestions(
  members: NetworkMember[],
  options: {
    dismissedIds: string[]
    boostUserIds?: string[]
    limit?: number
  },
): NetworkMember[] {
  const dismissed = new Set(options.dismissedIds)
  const boost = new Set(options.boostUserIds ?? [])
  const limit = Math.max(0, options.limit ?? 4)

  return members
    .filter((member) => !dismissed.has(member.user_id))
    .sort((a, b) => {
      const aRank = boost.has(a.user_id) ? 0 : 1
      const bRank = boost.has(b.user_id) ? 0 : 1
      return aRank - bRank
    })
    .slice(0, limit)
}
