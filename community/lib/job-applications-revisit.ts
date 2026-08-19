import type { MyJobApplication } from '~/community/lib/jobs'
import { communityRoutes } from '~/lib/routes'

export type JobApplicationRevisitCard = {
  applicationId: string
  jobId: string
  title: string
  subtitle: string | null
  statusLabel: string
  href: string
}

function formatStatus(status: string) {
  const normalized = status.replace(/_/g, ' ').trim()
  if (!normalized) return 'Submitted'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function buildJobApplicationRevisitCards(
  applications: MyJobApplication[],
  limit = 5,
): JobApplicationRevisitCard[] {
  return applications
    .filter((application) => application.job?.id)
    .slice(0, limit)
    .map((application) => {
      const job = application.job!
      return {
        applicationId: application.id,
        jobId: job.id,
        title: job.title,
        subtitle: [job.company_name, job.location, job.job_type].filter(Boolean).join(' · '),
        statusLabel: formatStatus(application.status),
        href: communityRoutes.job(job.id),
      }
    })
}
