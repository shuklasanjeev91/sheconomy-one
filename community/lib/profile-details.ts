import { supabase } from '~/lib/supabase'
import type { Tables } from '~/lib/supabase'

export type ProfileExperience = Pick<
  Tables<'experiences'>,
  | 'id'
  | 'title'
  | 'company_name'
  | 'employment_type'
  | 'location'
  | 'location_type'
  | 'start_date'
  | 'end_date'
  | 'is_current'
  | 'description'
  | 'industry'
  | 'skills'
>

export type ProfileEducation = Pick<
  Tables<'education'>,
  | 'id'
  | 'school'
  | 'degree'
  | 'field_of_study'
  | 'start_year'
  | 'end_year'
  | 'grade'
  | 'activities'
  | 'description'
  | 'location'
  | 'school_logo_url'
  | 'skills'
>

export type ProfileSkill = Pick<
  Tables<'skills'>,
  'id' | 'skill_name' | 'proficiency_level' | 'years_of_experience' | 'endorsements_count'
>

export type ProfileLanguage = Pick<
  Tables<'languages'>,
  'id' | 'language_name' | 'proficiency'
>

export type ProfileSocialLinks = {
  websiteUrl: string | null
  portfolioUrl: string | null
  instagramUrl: string | null
  twitterUrl: string | null
  youtubeUrl: string | null
  githubUrl: string | null
}

export type ProfileDetails = {
  experiences: ProfileExperience[]
  education: ProfileEducation[]
  skills: ProfileSkill[]
  languages: ProfileLanguage[]
  interests: string[]
  socialLinks: ProfileSocialLinks
  profileCompletion: number | null
}

type ProfileDetailsRpcRow = {
  experiences?: ProfileExperience[] | null
  education?: ProfileEducation[] | null
  skills?: ProfileSkill[] | null
  languages?: ProfileLanguage[] | null
  interests?: string[] | null
  socialLinks?: ProfileSocialLinks | null
  profileCompletion?: number | null
}

function mapProfileDetailsPayload(payload: ProfileDetailsRpcRow): ProfileDetails {
  return {
    experiences: payload.experiences ?? [],
    education: payload.education ?? [],
    skills: payload.skills ?? [],
    languages: payload.languages ?? [],
    interests: payload.interests ?? [],
    socialLinks: {
      websiteUrl: payload.socialLinks?.websiteUrl ?? null,
      portfolioUrl: payload.socialLinks?.portfolioUrl ?? null,
      instagramUrl: payload.socialLinks?.instagramUrl ?? null,
      twitterUrl: payload.socialLinks?.twitterUrl ?? null,
      youtubeUrl: payload.socialLinks?.youtubeUrl ?? null,
      githubUrl: payload.socialLinks?.githubUrl ?? null,
    },
    profileCompletion: payload.profileCompletion ?? null,
  }
}

async function fetchProfileDetailsViaRpc(userId: string): Promise<{
  data: ProfileDetails | null
  error: string | null
}> {
  const { data, error } = await supabase.rpc('get_profile_details', { p_user_id: userId })

  if (error) {
    return { data: null, error: error.message }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: mapProfileDetailsPayload(data as ProfileDetailsRpcRow),
    error: null,
  }
}

const EXPERIENCE_SELECT =
  'id, title, company_name, employment_type, location, location_type, start_date, end_date, is_current, description, industry, skills'

const EDUCATION_SELECT =
  'id, school, degree, field_of_study, start_year, end_year, grade, activities, description, location, school_logo_url, skills'

const SKILL_SELECT =
  'id, skill_name, proficiency_level, years_of_experience, endorsements_count'

const LANGUAGE_SELECT = 'id, language_name, proficiency'

const PROFILE_META_SELECT =
  'interests, portfolio_url, profile_completion_percentage, website_url, instagram_url, twitter_url, youtube_url, github_url'

const EMPTY_SOCIAL_LINKS: ProfileSocialLinks = {
  websiteUrl: null,
  portfolioUrl: null,
  instagramUrl: null,
  twitterUrl: null,
  youtubeUrl: null,
  githubUrl: null,
}

export async function fetchProfileDetails(userId: string): Promise<{
  data: ProfileDetails
  error: string | null
}> {
  const rpcResult = await fetchProfileDetailsViaRpc(userId)
  if (rpcResult.data) {
    return { data: rpcResult.data, error: null }
  }

  const [experiencesRes, educationRes, skillsRes, languagesRes, profileRes] = await Promise.all([
    supabase
      .from('experiences')
      .select(EXPERIENCE_SELECT)
      .eq('user_id', userId)
      .order('is_current', { ascending: false })
      .order('start_date', { ascending: false }),
    supabase
      .from('education')
      .select(EDUCATION_SELECT)
      .eq('user_id', userId)
      .order('start_year', { ascending: false }),
    supabase
      .from('skills')
      .select(SKILL_SELECT)
      .eq('user_id', userId)
      .order('endorsements_count', { ascending: false })
      .order('skill_name', { ascending: true }),
    supabase
      .from('languages')
      .select(LANGUAGE_SELECT)
      .eq('user_id', userId)
      .order('language_name', { ascending: true }),
    supabase.from('profiles').select(PROFILE_META_SELECT).eq('id', userId).maybeSingle(),
  ])

  const errors = [
    experiencesRes.error,
    educationRes.error,
    skillsRes.error,
    languagesRes.error,
    profileRes.error,
  ]
    .filter(Boolean)
    .map((error) => error!.message)

  const profile = profileRes.data

  return {
    data: {
      experiences: experiencesRes.data ?? [],
      education: educationRes.data ?? [],
      skills: skillsRes.data ?? [],
      languages: languagesRes.data ?? [],
      interests: (profile?.interests as string[] | null) ?? [],
      socialLinks: {
        websiteUrl: profile?.website_url ?? null,
        portfolioUrl: profile?.portfolio_url ?? null,
        instagramUrl: profile?.instagram_url ?? null,
        twitterUrl: profile?.twitter_url ?? null,
        youtubeUrl: profile?.youtube_url ?? null,
        githubUrl: profile?.github_url ?? null,
      },
      profileCompletion: profile?.profile_completion_percentage ?? null,
    },
    error: errors.length ? errors.join('; ') : null,
  }
}

export function mergeProfileSocialLinks(
  profile: Partial<ProfileSocialLinks & ProfileDisplaySocialFields>,
  details?: ProfileSocialLinks | null,
): ProfileSocialLinks {
  return {
    websiteUrl: details?.websiteUrl ?? profile.website_url ?? null,
    portfolioUrl: details?.portfolioUrl ?? profile.portfolio_url ?? null,
    instagramUrl: details?.instagramUrl ?? profile.instagram_url ?? null,
    twitterUrl: details?.twitterUrl ?? profile.twitter_url ?? null,
    youtubeUrl: details?.youtubeUrl ?? profile.youtube_url ?? null,
    githubUrl: details?.githubUrl ?? profile.github_url ?? null,
  }
}

type ProfileDisplaySocialFields = {
  website_url?: string | null
  portfolio_url?: string | null
  instagram_url?: string | null
  twitter_url?: string | null
  youtube_url?: string | null
  github_url?: string | null
}
