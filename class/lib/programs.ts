import { supabase } from '~/lib/supabase/client'

import { BRAND_NAME } from '~/config/brand'

export type ProgramCategory = {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
}

export type ProgramAuthor = {
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

export type Program = {
  id: string
  title: string
  description: string
  category: string
  duration: string
  image_url: string | null
  video_url: string | null
  audio_url: string | null
  media_type: string
  language: string
  view_count: number
  like_count: number
  listen_count: number
  featured: boolean
  published_at: string | null
  seo_slug: string | null
  author_id: string | null
  external_author_id: string | null
  author: ProgramAuthor | null
}

export type ProgramsByCategory = {
  category: ProgramCategory
  programs: Program[]
}

const PROGRAM_SELECT = `
  id,
  title,
  description,
  category,
  duration,
  image_url,
  video_url,
  audio_url,
  media_type,
  language,
  view_count,
  like_count,
  listen_count,
  featured,
  published_at,
  seo_slug,
  author_id,
  external_author_id,
  profiles:author_id ( full_name, username, avatar_url )
`

type ProgramRow = {
  id: string
  title: string
  description: string
  category: string
  duration: string
  image_url: string | null
  video_url: string | null
  audio_url: string | null
  media_type: string
  language: string | null
  view_count: number | null
  like_count: number | null
  listen_count: number | null
  featured: boolean
  published_at: string | null
  seo_slug: string | null
  author_id: string | null
  external_author_id: string | null
  profiles: ProgramAuthor | ProgramAuthor[] | null
}

type ProfileAuthorRow = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

function toProgramAuthor(profile: ProfileAuthorRow): ProgramAuthor {
  return {
    full_name: profile.full_name,
    username: profile.username,
    avatar_url: profile.avatar_url,
  }
}

function hasResolvedAuthor(program: Pick<Program, 'author_id' | 'author'>): boolean {
  return Boolean(
    program.author_id ||
      program.author?.full_name?.trim() ||
      program.author?.username?.trim(),
  )
}

function attachAuthor(program: Program, profile: ProfileAuthorRow): Program {
  return {
    ...program,
    author_id: profile.id,
    author: toProgramAuthor(profile),
  }
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, ProfileAuthorRow>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', unique)
    .eq('is_deleted', false)

  if (error || !data) return new Map()

  return new Map(data.map((row) => [row.id, row as ProfileAuthorRow]))
}

function pickBestProfileMatch(name: string, profiles: ProfileAuthorRow[]): ProfileAuthorRow | null {
  if (!profiles.length) return null

  const normalized = name.trim().toLowerCase()
  const exact = profiles.find((profile) => profile.full_name?.trim().toLowerCase() === normalized)
  if (exact) return exact

  const contains = profiles.find((profile) => {
    const fullName = profile.full_name?.trim().toLowerCase() ?? ''
    const username = profile.username?.trim().toLowerCase() ?? ''
    const compactName = normalized.replace(/[^a-z0-9]/gi, '')
    return (
      (fullName && (fullName.includes(normalized) || normalized.includes(fullName))) ||
      (username && (username.includes(compactName) || compactName.includes(username)))
    )
  })

  return contains ?? null
}

async function fetchProfilesByParsedNames(names: string[]): Promise<Map<string, ProfileAuthorRow>> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const resolved = new Map<string, ProfileAuthorRow>()
  const chunkSize = 12

  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize)
    const filters = chunk.flatMap((name) => {
      const safeName = name.replace(/[%_,]/g, ' ').trim()
      const firstToken = safeName.split(/\s+/)[0]
      return [
        `full_name.ilike.%${safeName}%`,
        `username.ilike.%${safeName}%`,
        `full_name.ilike.%${firstToken}%`,
        `username.ilike.%${firstToken}%`,
      ]
    })

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .eq('is_deleted', false)
      .or(filters.join(','))
      .limit(250)

    for (const name of chunk) {
      const match = pickBestProfileMatch(name, (data ?? []) as ProfileAuthorRow[])
      if (match) resolved.set(name, match)
    }
  }

  return resolved
}

async function enrichProgramAuthors(programs: Program[], options?: { resolveByTitle?: boolean }): Promise<Program[]> {
  if (!programs.length) return programs

  try {
    const profileIds = programs.flatMap((program) =>
      [program.author_id, program.external_author_id].filter(Boolean),
    ) as string[]
    const profilesById = await fetchProfilesByIds(profileIds)

    const withLinkedAuthors = programs.map((program) => {
      if (hasResolvedAuthor(program)) {
        if (program.author_id && !program.author) {
          const profile = profilesById.get(program.author_id)
          return profile ? attachAuthor(program, profile) : program
        }
        return program
      }

      const profileId = program.external_author_id ?? program.author_id
      const profile = profileId ? profilesById.get(profileId) : null
      return profile ? attachAuthor(program, profile) : program
    })

    if (options?.resolveByTitle === false) {
      return withLinkedAuthors
    }

    const unresolved = withLinkedAuthors.filter((program) => !hasResolvedAuthor(program))
    const parsedNames = unresolved
      .map((program) => parseAuthorNameFromTitle(program.title))
      .filter((name): name is string => Boolean(name))

    const profilesByName = await fetchProfilesByParsedNames(parsedNames)

    return withLinkedAuthors.map((program) => {
      if (hasResolvedAuthor(program)) return program

      const parsedName = parseAuthorNameFromTitle(program.title)
      if (!parsedName) return program

      const profile = profilesByName.get(parsedName)
      return profile ? attachAuthor(program, profile) : program
    })
  } catch {
    return programs
  }
}

function mapProgram(row: ProgramRow): Program {
  const author = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    duration: row.duration,
    image_url: row.image_url,
    video_url: row.video_url,
    audio_url: row.audio_url,
    media_type: row.media_type,
    language: (row.language ?? 'en').trim() || 'en',
    view_count: row.view_count ?? 0,
    like_count: row.like_count ?? 0,
    listen_count: row.listen_count ?? 0,
    featured: row.featured,
    published_at: row.published_at,
    seo_slug: row.seo_slug,
    author_id: row.author_id,
    external_author_id: row.external_author_id,
    author,
  }
}

export function getProgramSlug(program: Pick<Program, 'id' | 'seo_slug'>): string {
  return program.seo_slug?.trim() || program.id
}

export function formatProgramViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`
  if (count <= 1) return `${count} view`
  return `${count} views`
}

export function formatProgramDuration(duration: string): string {
  const trimmed = duration?.trim()
  if (!trimmed) return ''
  return trimmed
}

export function parseAuthorNameFromTitle(title: string): string | null {
  const withMatch = title.match(/\bWith\s+([^|–—]+)/i)
  if (withMatch?.[1]?.trim()) return withMatch[1].trim()

  const byMatch = title.match(/\bby\s+([^|–—]+?)(?:\s*\||\s*$)/i)
  if (byMatch?.[1]?.trim()) return byMatch[1].trim()

  return null
}

export function getProgramAuthorDisplay(program: Pick<Program, 'title' | 'author'>): string {
  return (
    program.author?.full_name?.trim() ||
    program.author?.username?.trim() ||
    parseAuthorNameFromTitle(program.title) ||
    BRAND_NAME
  )
}

export function hasProgramAuthor(program: Pick<Program, 'title' | 'author_id' | 'author'>): boolean {
  return Boolean(
    program.author_id ||
      program.author?.full_name?.trim() ||
      program.author?.username?.trim() ||
      parseAuthorNameFromTitle(program.title),
  )
}

export function canLinkProgramAuthor(program: Pick<Program, 'author_id' | 'author'>): boolean {
  return Boolean(program.author_id && (program.author?.username?.trim() || program.author_id))
}

export async function fetchProgramCategories(): Promise<{
  categories: ProgramCategory[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('program_categories')
    .select('id, name, description, thumbnail_url, status')
    .or('status.eq.approved,status.eq.active,status.is.null')
    .order('name', { ascending: true })

  if (error) {
    return { categories: [], error: error.message }
  }

  const categories = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
  }))

  return { categories, error: null }
}

/** Distinct language codes for published programs (optionally scoped by media type). */
export async function fetchPublishedProgramLanguages(options?: {
  mediaType?: 'video' | 'audio'
}): Promise<{ languages: string[]; error: string | null }> {
  let query = supabase
    .from('programs')
    .select('language')
    .not('published_at', 'is', null)

  if (options?.mediaType) {
    query = query.eq('media_type', options.mediaType)
  }

  const { data, error } = await query.limit(1000)

  if (error) {
    return { languages: [], error: error.message }
  }

  const codes = new Set<string>()
  for (const row of data ?? []) {
    const code = (typeof row.language === 'string' ? row.language : 'en').trim().toLowerCase() || 'en'
    codes.add(code)
  }

  return {
    languages: Array.from(codes).sort((a, b) =>
      formatProgramLanguageLabel(a).localeCompare(formatProgramLanguageLabel(b)),
    ),
    error: null,
  }
}

function formatProgramLanguageLabel(code: string) {
  // Keep labels in sync with `~/class/lib/languages` without a circular import.
  const labels: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ar: 'Arabic',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
    ml: 'Malayalam',
    pa: 'Punjabi',
    ur: 'Urdu',
  }
  return labels[code] ?? code.toUpperCase()
}

export const PROGRAM_PAGE_SIZE = 24

export type ProgramsPageResult = {
  programs: Program[]
  page: number
  pageSize: number
  hasMore: boolean
  error: string | null
}

type PublishedProgramFilters = {
  category?: string
  mediaType?: 'video' | 'audio'
  featuredOnly?: boolean
  authorId?: string
  externalAuthorId?: string
  language?: string
  sort?: 'default' | 'popular' | 'newest' | 'az'
}

/** Paginated published programs — use with infinite scroll (no hard catalog cap). */
export async function fetchPublishedProgramsPage(
  page: number,
  pageSize = PROGRAM_PAGE_SIZE,
  options?: PublishedProgramFilters,
): Promise<ProgramsPageResult> {
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('programs')
    .select(PROGRAM_SELECT)
    .not('published_at', 'is', null)

  if (options?.category) {
    query = query.eq('category', options.category)
  }
  if (options?.mediaType) {
    query = query.eq('media_type', options.mediaType)
  }
  if (options?.featuredOnly) {
    query = query.eq('featured', true)
  }
  if (options?.language) {
    // Use ilike so DB values stored as 'EN', 'en', 'English', etc. all match
    // the normalized lowercase code that the language filter produces.
    query = query.ilike('language', options.language)
  }
  if (options?.authorId && options?.externalAuthorId) {
    query = query.or(
      `author_id.eq.${options.authorId},external_author_id.eq.${options.externalAuthorId}`,
    )
  } else if (options?.authorId) {
    query = query.eq('author_id', options.authorId)
  } else if (options?.externalAuthorId) {
    query = query.eq('external_author_id', options.externalAuthorId)
  }

  switch (options?.sort) {
    case 'popular':
      query = query.order('view_count', { ascending: false, nullsFirst: false })
      break
    case 'az':
      query = query.order('title', { ascending: true })
      break
    case 'newest':
    case 'default':
    default:
      query = query.order('published_at', { ascending: false })
      break
  }

  const { data, error } = await query.range(from, to)

  if (error) {
    return { programs: [], page, pageSize, hasMore: false, error: error.message }
  }

  const programs = await enrichProgramAuthors((data as ProgramRow[]).map(mapProgram), {
    resolveByTitle: false,
  })

  return {
    programs,
    page,
    pageSize,
    hasMore: (data?.length ?? 0) === pageSize,
    error: null,
  }
}

export async function fetchPublishedPrograms(options?: {
  category?: string
  mediaType?: 'video' | 'audio'
  featuredOnly?: boolean
  authorId?: string
  externalAuthorId?: string
  limit?: number
}): Promise<{ programs: Program[]; error: string | null }> {
  const limit = options?.limit ?? PROGRAM_PAGE_SIZE
  const result = await fetchPublishedProgramsPage(0, limit, {
    category: options?.category,
    mediaType: options?.mediaType,
    featuredOnly: options?.featuredOnly,
    authorId: options?.authorId,
    externalAuthorId: options?.externalAuthorId,
  })
  return { programs: result.programs, error: result.error }
}

/**
 * YouTube-style Up Next: same category + media type first, then fill with same host.
 */
export async function fetchUpNextPrograms(
  program: Pick<Program, 'id' | 'category' | 'media_type' | 'author_id' | 'external_author_id'>,
  limit = 12,
): Promise<{ programs: Program[]; error: string | null }> {
  const mediaType = program.media_type === 'audio' ? 'audio' : 'video'
  const seen = new Set<string>([program.id])
  const ordered: Program[] = []
  let lastError: string | null = null

  const categoryResult = await fetchPublishedPrograms({
    category: program.category || undefined,
    mediaType,
    limit: limit + 6,
  })
  if (categoryResult.error) lastError = categoryResult.error

  for (const item of categoryResult.programs) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    ordered.push(item)
    if (ordered.length >= limit) {
      return { programs: ordered, error: lastError }
    }
  }

  if (program.author_id || program.external_author_id) {
    const hostResult = await fetchPublishedPrograms({
      mediaType,
      authorId: program.author_id ?? undefined,
      externalAuthorId: program.external_author_id ?? undefined,
      limit: limit + 6,
    })
    if (hostResult.error) lastError = hostResult.error

    for (const item of hostResult.programs) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      ordered.push(item)
      if (ordered.length >= limit) break
    }
  }

  return { programs: ordered.slice(0, limit), error: lastError }
}

/** Fetch programs by id, preserving the caller's order. */
export async function fetchProgramsByIds(
  ids: string[],
): Promise<{ programs: Program[]; error: string | null }> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return { programs: [], error: null }

  const { data, error } = await supabase
    .from('programs')
    .select(PROGRAM_SELECT)
    .in('id', unique)
    .not('published_at', 'is', null)

  if (error) return { programs: [], error: error.message }

  const mapped = await enrichProgramAuthors((data as ProgramRow[]).map(mapProgram), {
    resolveByTitle: false,
  })
  const byId = new Map(mapped.map((program) => [program.id, program]))
  return {
    programs: unique.map((id) => byId.get(id)).filter((program): program is Program => Boolean(program)),
    error: null,
  }
}

/** Programs the user is enrolled in via `class_enrollment`. */
export async function fetchEnrolledPrograms(
  userId: string,
): Promise<{ programs: Program[]; error: string | null }> {
  const { data, error } = await supabase
    .from('class_enrollment')
    .select('course_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) return { programs: [], error: error.message }
  const ids = (data ?? []).map((row) => row.course_id)
  return fetchProgramsByIds(ids)
}

export async function fetchProgramBySlug(
  slug: string,
): Promise<{ program: Program | null; error: string | null }> {
  const bySlug = await supabase
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('seo_slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle()

  if (bySlug.data) {
    const [program] = await enrichProgramAuthors([mapProgram(bySlug.data as ProgramRow)])
    return { program: program ?? null, error: null }
  }

  const byId = await supabase
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('id', slug)
    .not('published_at', 'is', null)
    .maybeSingle()

  if (byId.error) {
    return { program: null, error: byId.error.message }
  }

  if (!byId.data) {
    return { program: null, error: bySlug.error?.message ?? null }
  }

  const [program] = await enrichProgramAuthors([mapProgram(byId.data as ProgramRow)])
  return { program: program ?? null, error: null }
}

export function groupProgramsByCategory(
  programs: Program[],
  categories: ProgramCategory[],
): ProgramsByCategory[] {
  const categoryByName = new Map(categories.map((category) => [category.name, category]))
  const buckets = new Map<string, Program[]>()

  for (const program of programs) {
    const key = program.category?.trim() || 'Other'
    const existing = buckets.get(key) ?? []
    existing.push(program)
    buckets.set(key, existing)
  }

  const orderedNames = [
    ...categories.map((category) => category.name),
    ...[...buckets.keys()].filter((name) => !categoryByName.has(name)),
  ]

  const seen = new Set<string>()
  const rows: ProgramsByCategory[] = []

  for (const name of orderedNames) {
    if (seen.has(name)) continue
    seen.add(name)
    const items = buckets.get(name)
    if (!items?.length) continue

    rows.push({
      category: categoryByName.get(name) ?? {
        id: name,
        name,
        description: null,
        thumbnail_url: null,
      },
      programs: items,
    })
  }

  return rows
}

export async function recordProgramView(programId: string): Promise<void> {
  await supabase.rpc('increment_program_views', { program_id: programId })
}

export function extractYoutubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] || null
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const segments = parsed.pathname.split('/').filter(Boolean)
      return (
        parsed.searchParams.get('v') ||
        (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live'
          ? segments[1]
          : segments.pop()) ||
        null
      )
    }
  } catch {
    return null
  }
  return null
}

/** Cover image for rails/cards — explicit image, then YouTube poster from video_url. */
export function getProgramThumbnailUrl(program: Pick<Program, 'image_url' | 'video_url'>): string | null {
  if (program.image_url?.trim()) return program.image_url.trim()
  if (!program.video_url) return null
  const id = extractYoutubeVideoId(program.video_url)
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  return null
}
