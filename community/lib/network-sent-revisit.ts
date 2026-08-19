import type { NetworkMember } from '~/community/lib/network'
import { appRoutes, communityRoutes } from '~/lib/routes'

export type NetworkSentRevisitCard = {
  userId: string
  fullName: string
  headline: string | null
  avatarUrl: string | null
  href: string
}

function networkSentProfileHref(member: NetworkMember) {
  const handle = member.username?.trim() || member.user_id?.trim()
  return handle ? appRoutes.userProfile(handle) : communityRoutes.peopleTab('pending-sent')
}

export function buildNetworkSentRevisitCards(
  members: NetworkMember[],
  limit = 4,
): NetworkSentRevisitCard[] {
  return members.slice(0, limit).map((member) => ({
    userId: member.user_id,
    fullName: member.full_name,
    headline: member.headline,
    avatarUrl: member.avatar_url,
    href: networkSentProfileHref(member),
  }))
}

export function networkSentRevisitSeeAllHref() {
  return communityRoutes.peopleTab('pending-sent')
}
