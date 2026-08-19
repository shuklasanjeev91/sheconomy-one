import type { NetworkMember } from '~/community/lib/network'

export function filterNetworkSuggestions(
  members: NetworkMember[],
  dismissedIds: string[],
  limit = 4,
): NetworkMember[] {
  const dismissed = new Set(dismissedIds)
  return members.filter((member) => !dismissed.has(member.user_id)).slice(0, Math.max(0, limit))
}
