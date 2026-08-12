import {
  createGroup,
  fetchGroupMembership,
  joinGroup,
} from '~/community/lib/groups'
import { slugifyTitle } from '~/commerce/lib/seo-urls'
import { supabase } from '~/lib/supabase/client'
import { communityRoutes } from '~/lib/routes'

/**
 * Find or create a public community group for a Class program and join the member.
 * Matching is by group title === program title (v1 — no FK yet).
 */
export async function ensureCohortGroupMembership(input: {
  userId: string
  programTitle: string
  programSlug?: string | null
}): Promise<{ groupId: string | null; created: boolean; error: string | null; path: string | null }> {
  const title = input.programTitle.trim()
  if (!title) return { groupId: null, created: false, error: 'Program title required', path: null }

  const cohortTitle = `${title} · Cohort`

  const { data: existing } = await supabase
    .from('groups')
    .select('id, group_type, title, name')
    .eq('title', cohortTitle)
    .maybeSingle()

  let groupId = existing?.id ?? null
  let created = false
  let groupType = existing?.group_type ?? 'public'

  if (!groupId) {
    const nameBase = slugifyTitle(title, 48) || `cohort-${Date.now()}`
    const { data, error } = await createGroup(input.userId, {
      name: `${nameBase}-cohort`,
      title: cohortTitle,
      description: `Learning cohort for ${title}. Discuss lessons, ask questions, and stay accountable together.`,
      groupType: 'public',
    })
    if (error || !data) {
      return { groupId: null, created: false, error: error ?? 'Could not create cohort group', path: null }
    }
    groupId = data.id
    groupType = data.group_type ?? 'public'
    created = true
  } else {
    const membership = await fetchGroupMembership(groupId, input.userId)
    if (!membership.isMember) {
      const { error } = await joinGroup(groupId, input.userId, groupType)
      if (error) {
        return { groupId, created: false, error, path: communityRoutes.group(groupId) }
      }
    }
  }

  return {
    groupId,
    created,
    error: null,
    path: groupId ? communityRoutes.group(groupId) : null,
  }
}
