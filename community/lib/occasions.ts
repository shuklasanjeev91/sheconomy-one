import { supabase } from '~/lib/supabase/client'

export type ConnectionOccasion = {
  userId: string
  fullName: string | null
  username: string | null
  avatarUrl: string | null
  occasion: 'birthday' | 'marriage_anniversary' | 'work_anniversary' | string
  label: string
  years: number | null
  companyName: string | null
}

function mapRow(row: {
  user_id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  occasion: string
  label: string
  years: number | null
  company_name: string | null
}): ConnectionOccasion {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    occasion: row.occasion,
    label: row.label,
    years: row.years,
    companyName: row.company_name,
  }
}

/** LinkedIn-style “today’s celebrations” among accepted connections. */
export async function fetchConnectionOccasionsToday(): Promise<{
  data: ConnectionOccasion[]
  error: string | null
}> {
  const { data, error } = await supabase.rpc('connection_occasions_today')
  if (error) return { data: [], error: error.message }
  return {
    data: ((data ?? []) as Parameters<typeof mapRow>[0][]).map(mapRow),
    error: null,
  }
}

export function occasionCongratsCopy(item: ConnectionOccasion): {
  content: string
  celebrationTitle: string
  occasion: string
} {
  const name = item.fullName?.split(' ')[0] || item.username || 'friend'
  if (item.occasion === 'birthday') {
    return {
      occasion: 'birthday',
      celebrationTitle: `Happy birthday, ${name}!`,
      content: `Wishing you a wonderful birthday, ${name}! 🎂`,
    }
  }
  if (item.occasion === 'marriage_anniversary') {
    const years =
      item.years && item.years > 0 ? ` on ${item.years} year${item.years === 1 ? '' : 's'}` : ''
    return {
      occasion: 'marriage_anniversary',
      celebrationTitle: `Happy anniversary${years}!`,
      content: `Congratulations on your anniversary${years}, ${name}! 💍`,
    }
  }
  const years =
    item.years && item.years > 0 ? `${item.years} year${item.years === 1 ? '' : 's'}` : 'another year'
  const company = item.companyName ? ` at ${item.companyName}` : ''
  return {
    occasion: 'work_anniversary',
    celebrationTitle: `${years}${company}`,
    content: `Congrats on ${years}${company}, ${name}! 🎊`,
  }
}
