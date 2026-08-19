import type { NetworkMember } from '~/community/lib/network'

export function selectNetworkInvitations(
  members: NetworkMember[],
  limit = 4,
): NetworkMember[] {
  return members.slice(0, Math.max(0, limit))
}
