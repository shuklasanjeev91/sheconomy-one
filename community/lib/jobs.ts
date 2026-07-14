import { supabase } from '~/lib/supabase/client'

export const JOB_PAGE_SIZE = 20

export type JobListing = {
  id: string
  title: string
  company_name: string
  company_logo: string | null
  description: string
  location: string
  job_type: string
  experience_level: string
  salary_range: string | null
  is_remote: boolean | null
  is_active: boolean | null
  is_applied: boolean
  is_saved: boolean
  application_count: number
  benefits: string | null
  requirements: string | null
  industry: string | null
  posted_by: string
  poster_name: string
  poster_avatar: string
  created_at: string
  updated_at: string
  expires_at: string | null
}

export type JobSearchParams = {
  search?: string
  jobType?: string
  experience?: string
  location?: string
  isRemote?: boolean
  page?: number
}

export async function searchJobs(
  params: JobSearchParams = {},
): Promise<{ items: JobListing[]; hasMore: boolean; error: string | null }> {
  const page = params.page ?? 0
  const { data, error } = await supabase.rpc('search_jobs', {
    search_query: params.search ?? '',
    job_type_filter: params.jobType ?? '',
    experience_filter: params.experience ?? '',
    job_location: params.location ?? '',
    is_remote_filter: params.isRemote ?? false,
    limit_count: JOB_PAGE_SIZE,
    offset_count: page * JOB_PAGE_SIZE,
  })

  if (error) return { items: [], hasMore: false, error: error.message }

  const items = await enrichWithIndustry((data ?? []) as JobListing[])
  return { items, hasMore: items.length === JOB_PAGE_SIZE, error: null }
}

/**
 * The `search_jobs` RPC does not return the `industry` column, so we hydrate it
 * from the base table in a single follow-up query. Keeps industry filtering
 * fully functional without changing the remote function signature.
 */
async function enrichWithIndustry(items: JobListing[]): Promise<JobListing[]> {
  if (!items.length) return items
  const ids = items.map((job) => job.id)
  const { data } = await supabase.from('jobs').select('id, industry').in('id', ids)
  const industryById = new Map((data ?? []).map((row) => [row.id, row.industry as string | null]))
  return items.map((job) => ({ ...job, industry: industryById.get(job.id) ?? job.industry ?? null }))
}

export async function searchJobsByCompany(
  companyName: string,
): Promise<{ items: JobListing[]; error: string | null }> {
  const { data, error } = await supabase.rpc('search_jobs', {
    search_query: companyName,
    limit_count: 50,
    offset_count: 0,
  })

  if (error) return { items: [], error: error.message }

  const items = ((data ?? []) as JobListing[]).filter(
    (job) => job.company_name.toLowerCase() === companyName.toLowerCase(),
  )
  return { items, error: null }
}

export async function fetchJob(
  id: string,
  userId?: string,
): Promise<{ data: JobListing | null; error: string | null }> {
  const { data: row, error: rowError } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
  if (rowError || !row) return { data: null, error: rowError?.message ?? 'Job not found' }

  let isApplied = false
  let isSaved = false
  if (userId) {
    const [{ data: application }, { data: saved }] = await Promise.all([
      supabase.from('job_applications').select('id').eq('job_id', id).eq('user_id', userId).maybeSingle(),
      supabase.from('saved_jobs').select('id').eq('job_id', id).eq('user_id', userId).maybeSingle(),
    ])
    isApplied = !!application
    isSaved = !!saved
  }

  const { data: poster } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', row.posted_by)
    .maybeSingle()

  return {
    data: {
      id: row.id,
      title: row.title,
      company_name: row.company_name,
      company_logo: row.company_logo,
      description: row.description,
      location: row.location,
      job_type: row.job_type,
      experience_level: row.experience_level,
      salary_range: row.salary_range,
      is_remote: row.is_remote,
      is_active: row.is_active,
      is_applied: isApplied,
      is_saved: isSaved,
      application_count: row.applicants_count ?? 0,
      benefits: row.benefits,
      requirements: row.requirements,
      industry: row.industry ?? null,
      posted_by: row.posted_by,
      poster_name: poster?.full_name ?? 'Recruiter',
      poster_avatar: poster?.avatar_url ?? '',
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
      expires_at: row.expires_at,
    },
    error: null,
  }
}

export async function saveJob(jobId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_jobs').insert({ job_id: jobId, user_id: userId })
  return { error: error?.message ?? null }
}

export async function unsaveJob(jobId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('job_id', jobId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function applyToJob(
  jobId: string,
  userId: string,
  input?: { coverLetter?: string; resumeUrl?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('job_applications').insert({
    job_id: jobId,
    user_id: userId,
    status: 'submitted',
    cover_letter: input?.coverLetter ?? null,
    resume_url: input?.resumeUrl ?? null,
  })
  return { error: error?.message ?? null }
}

export type CreateJobInput = {
  title: string
  companyName: string
  description: string
  location: string
  jobType: string
  experienceLevel: string
  salaryRange?: string
  isRemote?: boolean
  requirements?: string
  benefits?: string
  industry?: string
}

export async function createJob(
  userId: string,
  input: CreateJobInput,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const location = input.isRemote ? 'Remote' : input.location.trim()
  if (!location) {
    return { data: null, error: 'Job location is required.' }
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      title: input.title.trim(),
      company_name: input.companyName.trim(),
      description: input.description.trim(),
      location,
      job_type: input.jobType,
      experience_level: input.experienceLevel,
      salary_range: input.salaryRange?.trim() || null,
      is_remote: input.isRemote ?? false,
      requirements: input.requirements?.trim() || null,
      benefits: input.benefits?.trim() || null,
      industry: input.industry?.trim() || null,
      posted_by: userId,
      is_active: true,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}
