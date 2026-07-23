import {
  fetchProgramCategories,
  fetchPublishedPrograms,
  fetchPublishedProgramsPage,
  PROGRAM_PAGE_SIZE,
  type Program,
  type ProgramCategory,
} from '~/class/lib/programs'

export type ClassesBootstrapData = {
  categories: ProgramCategory[]
  programs: Program[]
  featured: Program[]
  hasMore: boolean
  error: string | null
}

/** First page only — list continues via infinite scroll on ClassesScreen. */
export async function fetchClassesBootstrap(
  mediaType: 'video' | 'audio',
): Promise<ClassesBootstrapData> {
  try {
    const [categoryResult, programResult, featuredResult] = await Promise.all([
      fetchProgramCategories(),
      fetchPublishedProgramsPage(0, PROGRAM_PAGE_SIZE, { mediaType }),
      fetchPublishedPrograms({ featuredOnly: true, mediaType, limit: 12 }),
    ])

    const error =
      categoryResult.error ??
      programResult.error ??
      featuredResult.error ??
      null

    return {
      categories: categoryResult.categories,
      programs: programResult.programs,
      featured: featuredResult.programs,
      hasMore: programResult.hasMore,
      error,
    }
  } catch (loadError) {
    return {
      categories: [],
      programs: [],
      featured: [],
      hasMore: false,
      error: loadError instanceof Error ? loadError.message : 'Failed to load classes',
    }
  }
}
