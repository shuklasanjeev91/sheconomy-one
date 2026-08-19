import type { Group } from '~/community/lib/groups'
import { communityRoutes } from '~/lib/routes'

export type GroupsRevisitCard = {
  groupId: string
  title: string
  subtitle: string | null
  memberCount: number
  href: string
}

export function buildGroupsRevisitCards(groups: Group[], limit = 6): GroupsRevisitCard[] {
  return groups
    .slice()
    .sort((a, b) => (b.members_count ?? 0) - (a.members_count ?? 0))
    .slice(0, limit)
    .map((group) => ({
      groupId: group.id,
      title: group.title || group.name,
      subtitle: [group.group_type, group.location].filter(Boolean).join(' · ') || null,
      memberCount: group.members_count ?? 0,
      href: communityRoutes.group(group.id),
    }))
}
