import type { JobListing } from '~/community/lib/jobs'
import { communityRoutes } from '~/lib/routes'

export type JobRevisitCard = {
  jobId: string
  title: string
  subtitle: string | null
  badge: string
  href: string
  isApplied: boolean
}

export function buildJobRevisitCards(jobs: JobListing[], limit = 6): JobRevisitCard[] {
  return jobs
    .filter((job) => job.is_active !== false)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit)
    .map((job) => ({
      jobId: job.id,
      title: job.title,
      subtitle: [job.company_name, job.location, job.is_remote ? 'Remote' : null]
        .filter(Boolean)
        .join(' · '),
      badge: job.is_applied ? 'Applied' : 'Saved',
      href: communityRoutes.job(job.id),
      isApplied: job.is_applied,
    }))
}
