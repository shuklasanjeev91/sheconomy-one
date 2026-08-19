import { fetchNetworkSummary } from '~/community/lib/network'
import { parseCreatorMode } from '~/community/lib/creator-mode'
import { supabase } from '~/lib/supabase/client'

export type CreatorSpotlightCard = {
  userId: string
  username: string | null
  fullName: string
  headline: string | null
  avatarUrl: string | null
  topics: string[]
}

type ProfileSpotlightRow = {
  id: string
  username: string | null
  full_name: string | null
  headline: string | null
  avatar_url: string | null
  job_preferences: unknown
}

function buildCreatorCard(row: ProfileSpotlightRow): CreatorSpotlightCard | null {
  const creator = parseCreatorMode(row.job_preferences)
  if (!creator.enabled) return null

  return {
    userId: row.id,
    username: row.username,
    fullName: row.full_name?.trim() || row.username || 'Member',
    headline: row.headline,
    avatarUrl: row.avatar_url,
    topics: creator.topics ?? [],
  }
}

export async function fetchCreatorSpotlight(
  userId: string,
  limit = 6,
): Promise<{ cards: CreatorSpotlightCard[]; error: string | null }> {
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
    .map((row) => buildCreatorCard(row as ProfileSpotlightRow))
    .filter((card): card is CreatorSpotlightCard => Boolean(card))

  const rank = new Map(priorityUserIds.map((id, index) => [id, index]))
  return {
    cards: [...cards]
      .sort((a, b) => (rank.get(a.userId) ?? 999) - (rank.get(b.userId) ?? 999))
      .slice(0, limit),
    error: summary.error,
  }
}
