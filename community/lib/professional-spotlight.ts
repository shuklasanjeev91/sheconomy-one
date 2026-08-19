import { fetchNetworkSummary } from '~/community/lib/network'
import { parseOpenToServices } from '~/community/lib/open-to-services'
import { parseOpenToWork } from '~/community/lib/open-to-work'
import { supabase } from '~/lib/supabase/client'

export type ProfessionalSpotlightCard = {
  userId: string
  username: string | null
  fullName: string
  headline: string | null
  avatarUrl: string | null
  intent: 'open_to_work' | 'open_to_services'
  intentLabel: string
  detail: string | null
}

type ProfileSpotlightRow = {
  id: string
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
  job_preferences: unknown
}

function buildSpotlightCard(row: ProfileSpotlightRow): ProfessionalSpotlightCard | null {
  const work = parseOpenToWork(row.job_preferences)
  if (work.enabled) {
    return {
      userId: row.id,
      username: row.username,
      fullName: row.full_name?.trim() || row.username || 'Member',
      headline: row.headline,
      avatarUrl: row.avatar_url,
      intent: 'open_to_work',
      intentLabel: work.title ?? 'Open to work',
      detail: work.locations?.length ? work.locations.join(' · ') : null,
    }
  }

  const services = parseOpenToServices(row.job_preferences)
  if (services.enabled) {
    return {
      userId: row.id,
      username: row.username,
      fullName: row.full_name?.trim() || row.username || 'Member',
      headline: row.headline,
      avatarUrl: row.avatar_url,
      intent: 'open_to_services',
      intentLabel: services.title ?? 'Open to services',
      detail: services.categories?.length ? services.categories.join(' · ') : null,
    }
  }

  return null
}

export function orderProfessionalSpotlightCards(
  cards: ProfessionalSpotlightCard[],
  priorityUserIds: string[],
  limit: number,
): ProfessionalSpotlightCard[] {
  const rank = new Map(priorityUserIds.map((id, index) => [id, index]))
  return [...cards]
    .sort((a, b) => (rank.get(a.userId) ?? 999) - (rank.get(b.userId) ?? 999))
    .slice(0, limit)
}

export async function fetchProfessionalSpotlight(
  userId: string,
  limit = 6,
): Promise<{ cards: ProfessionalSpotlightCard[]; error: string | null }> {
  const summary = await fetchNetworkSummary(userId)
  const priorityUserIds = [
    ...summary.connections.map((member) => member.user_id),
    ...summary.suggestions.map((member) => member.user_id),
  ].filter((id) => id && id !== userId)
  const uniqueIds = [...new Set(priorityUserIds)].slice(0, 40)

  if (!uniqueIds.length) {
    return { cards: [], error: summary.error }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, headline, avatar_url, job_preferences')
    .in('id', uniqueIds)
    .eq('is_deleted', false)

  if (error) return { cards: [], error: error.message }

  const cards = (data ?? [])
    .map((row) => buildSpotlightCard(row as ProfileSpotlightRow))
    .filter((card): card is ProfessionalSpotlightCard => Boolean(card))

  return {
    cards: orderProfessionalSpotlightCards(cards, priorityUserIds, limit),
    error: summary.error,
  }
}
