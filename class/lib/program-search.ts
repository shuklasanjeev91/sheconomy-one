import { supabase } from '~/lib/supabase/client'

import {
  getProgramSlug,
  getProgramThumbnailUrl,
  type Program,
  type ProgramAuthor,
} from '~/class/lib/programs'

function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()\\%]/g, ' ').trim()
}

type ProgramSearchRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  image_url: string | null
  video_url: string | null
  audio_url: string | null
  media_type: string | null
  seo_slug: string | null
  author_id: string | null
  profiles: ProgramAuthor | ProgramAuthor[] | null
}

function mapAuthor(profiles: ProgramAuthor | ProgramAuthor[] | null): ProgramAuthor | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

function mapProgram(row: ProgramSearchRow): Program {
  const author = mapAuthor(row.profiles)
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? '',
    duration: '',
    image_url: row.image_url,
    video_url: row.video_url,
    audio_url: row.audio_url,
    media_type: row.media_type ?? 'video',
    language: '',
    view_count: 0,
    like_count: 0,
    listen_count: 0,
    featured: false,
    published_at: null,
    seo_slug: row.seo_slug,
    author_id: row.author_id,
    external_author_id: null,
    author,
  }
}

/**
 * Search published class programs by title, description, or category.
 * Cross-platform (web / iOS / Android) via Supabase.
 */
export async function searchPrograms(
  query: string,
  limit = 12,
): Promise<{ programs: Program[]; error: string | null }> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { programs: [], error: null }
  }

  const safe = sanitizeFilterValue(trimmed)
  if (!safe) return { programs: [], error: null }

  const { data, error } = await supabase
    .from('programs')
    .select(
      `
      id,
      title,
      description,
      category,
      image_url,
      video_url,
      audio_url,
      media_type,
      seo_slug,
      author_id,
      profiles:author_id ( full_name, username, avatar_url )
    `,
    )
    .not('published_at', 'is', null)
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { programs: [], error: error.message }
  }

  const programs = ((data ?? []) as ProgramSearchRow[]).map(mapProgram)
  return { programs, error: null }
}

export function programToSearchFields(program: Program) {
  const slug = getProgramSlug(program)
  return {
    id: program.id,
    title: program.title,
    subtitle: program.author?.full_name || program.author?.username || program.category || null,
    imageUrl: getProgramThumbnailUrl(program),
    slug,
  }
}
