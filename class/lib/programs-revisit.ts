import type { Program } from '~/class/lib/programs'
import { classRoutes } from '~/lib/routes'

export type ProgramRevisitCard = {
  programId: string
  title: string
  subtitle: string | null
  badge: string
  imageUrl: string | null
  href: string
}

function mediaBadge(mediaType: string) {
  if (mediaType === 'video') return 'Video'
  if (mediaType === 'audio') return 'Audio'
  return 'Program'
}

export function buildProgramRevisitCards(programs: Program[], limit = 6): ProgramRevisitCard[] {
  return programs.slice(0, limit).map((program) => ({
    programId: program.id,
    title: program.title,
    subtitle: program.author?.full_name ?? program.category ?? null,
    badge: mediaBadge(program.media_type),
    imageUrl: program.image_url,
    href: classRoutes.program(program.seo_slug ?? program.id),
  }))
}
