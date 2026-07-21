import { supabase } from '~/lib/supabase'
import type {
  ProfileEducation,
  ProfileExperience,
  ProfileLanguage,
  ProfileSkill,
} from '~/community/lib/profile-details'
import { parseSkillTags } from '~/community/lib/profile-format'

export const EMPLOYMENT_TYPE_OPTIONS = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Internship',
  'Self-employed',
] as const

export const LOCATION_TYPE_OPTIONS = ['On-site', 'Hybrid', 'Remote'] as const

export const SKILL_PROFICIENCY_OPTIONS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
] as const

export const LANGUAGE_PROFICIENCY_OPTIONS = [
  'Elementary',
  'Limited working',
  'Professional working',
  'Native or bilingual',
] as const

export type ExperienceInput = {
  title: string
  company_name: string
  employment_type?: string
  location?: string
  location_type?: string
  start_date?: string
  end_date?: string
  is_current: boolean
  description?: string
  industry?: string
  skills?: string
}

export type EducationInput = {
  school: string
  degree?: string
  field_of_study?: string
  start_year?: string
  end_year?: string
  grade?: string
  activities?: string
  description?: string
  location?: string
  skills?: string
}

export type SkillInput = {
  skill_name: string
  proficiency_level?: string
  years_of_experience?: string
}

export type LanguageInput = {
  language_name: string
  proficiency?: string
}

export type AboutInput = {
  full_name?: string
  headline?: string
  bio?: string
  occupation?: string
  industry?: string
  business_name?: string
  location?: string
}

function trimOrNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

function parseYear(value?: string) {
  if (!value?.trim()) return null
  const year = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null
  return year
}

function parseYearsExperience(value?: string) {
  if (!value?.trim()) return null
  const years = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(years) || years < 0 || years > 80) return null
  return years
}

function normalizeMonthDate(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

export function experienceInputFromRow(row: ProfileExperience): ExperienceInput {
  return {
    title: row.title ?? '',
    company_name: row.company_name ?? '',
    employment_type: row.employment_type ?? '',
    location: row.location ?? '',
    location_type: row.location_type ?? '',
    start_date: row.start_date?.slice(0, 7) ?? '',
    end_date: row.end_date?.slice(0, 7) ?? '',
    is_current: row.is_current ?? false,
    description: row.description ?? '',
    industry: row.industry ?? '',
    skills: row.skills ?? '',
  }
}

export function educationInputFromRow(row: ProfileEducation): EducationInput {
  return {
    school: row.school,
    degree: row.degree ?? '',
    field_of_study: row.field_of_study ?? '',
    start_year: row.start_year != null ? String(row.start_year) : '',
    end_year: row.end_year != null ? String(row.end_year) : '',
    grade: row.grade ?? '',
    activities: row.activities ?? '',
    description: row.description ?? '',
    location: row.location ?? '',
    skills: row.skills ?? '',
  }
}

export function skillInputFromRow(row: ProfileSkill): SkillInput {
  return {
    skill_name: row.skill_name,
    proficiency_level: row.proficiency_level ?? '',
    years_of_experience:
      row.years_of_experience != null ? String(row.years_of_experience) : '',
  }
}

export function languageInputFromRow(row: ProfileLanguage): LanguageInput {
  return {
    language_name: row.language_name,
    proficiency: row.proficiency ?? '',
  }
}

export function validateExperienceInput(input: ExperienceInput): string | null {
  if (!input.title.trim()) return 'Enter a job title.'
  if (!input.company_name.trim()) return 'Enter a company or organization.'
  if (!input.is_current && input.start_date && input.end_date) {
    if (input.start_date > input.end_date) return 'End date must be after start date.'
  }
  return null
}

export function validateEducationInput(input: EducationInput): string | null {
  if (!input.school.trim()) return 'Enter a school or university.'
  const startYear = parseYear(input.start_year)
  const endYear = parseYear(input.end_year)
  if (input.start_year?.trim() && startYear == null) return 'Enter a valid start year.'
  if (input.end_year?.trim() && endYear == null) return 'Enter a valid end year.'
  if (startYear != null && endYear != null && startYear > endYear) {
    return 'End year must be after start year.'
  }
  return null
}

export function validateSkillInput(input: SkillInput): string | null {
  if (!input.skill_name.trim()) return 'Enter a skill name.'
  if (input.years_of_experience?.trim() && parseYearsExperience(input.years_of_experience) == null) {
    return 'Enter valid years of experience.'
  }
  return null
}

export function validateLanguageInput(input: LanguageInput): string | null {
  if (!input.language_name.trim()) return 'Enter a language.'
  return null
}

export function parseInterestsInput(value: string): string[] {
  return [...new Set(parseSkillTags(value))]
}

export async function createExperience(
  userId: string,
  input: ExperienceInput,
): Promise<{ error: string | null }> {
  const validationError = validateExperienceInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('experiences').insert({
    user_id: userId,
    title: input.title.trim(),
    company_name: input.company_name.trim(),
    employment_type: trimOrNull(input.employment_type),
    location: trimOrNull(input.location),
    location_type: trimOrNull(input.location_type),
    start_date: normalizeMonthDate(input.start_date),
    end_date: input.is_current ? null : normalizeMonthDate(input.end_date),
    is_current: input.is_current,
    description: trimOrNull(input.description),
    industry: trimOrNull(input.industry),
    skills: trimOrNull(input.skills),
  })

  return { error: error?.message ?? null }
}

export async function updateExperience(
  userId: string,
  id: string,
  input: ExperienceInput,
): Promise<{ error: string | null }> {
  const validationError = validateExperienceInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('experiences')
    .update({
      title: input.title.trim(),
      company_name: input.company_name.trim(),
      employment_type: trimOrNull(input.employment_type),
      location: trimOrNull(input.location),
      location_type: trimOrNull(input.location_type),
      start_date: normalizeMonthDate(input.start_date),
      end_date: input.is_current ? null : normalizeMonthDate(input.end_date),
      is_current: input.is_current,
      description: trimOrNull(input.description),
      industry: trimOrNull(input.industry),
      skills: trimOrNull(input.skills),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deleteExperience(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('experiences').delete().eq('id', id).eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function createEducation(
  userId: string,
  input: EducationInput,
): Promise<{ error: string | null }> {
  const validationError = validateEducationInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('education').insert({
    user_id: userId,
    school: input.school.trim(),
    degree: trimOrNull(input.degree),
    field_of_study: trimOrNull(input.field_of_study),
    start_year: parseYear(input.start_year),
    end_year: parseYear(input.end_year),
    grade: trimOrNull(input.grade),
    activities: trimOrNull(input.activities),
    description: trimOrNull(input.description),
    location: trimOrNull(input.location),
    skills: trimOrNull(input.skills),
  })

  return { error: error?.message ?? null }
}

export async function updateEducation(
  userId: string,
  id: string,
  input: EducationInput,
): Promise<{ error: string | null }> {
  const validationError = validateEducationInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('education')
    .update({
      school: input.school.trim(),
      degree: trimOrNull(input.degree),
      field_of_study: trimOrNull(input.field_of_study),
      start_year: parseYear(input.start_year),
      end_year: parseYear(input.end_year),
      grade: trimOrNull(input.grade),
      activities: trimOrNull(input.activities),
      description: trimOrNull(input.description),
      location: trimOrNull(input.location),
      skills: trimOrNull(input.skills),
    })
    .eq('id', id)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deleteEducation(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('education').delete().eq('id', id).eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function createSkill(userId: string, input: SkillInput): Promise<{ error: string | null }> {
  const validationError = validateSkillInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('skills').insert({
    user_id: userId,
    skill_name: input.skill_name.trim(),
    proficiency_level: trimOrNull(input.proficiency_level),
    years_of_experience: parseYearsExperience(input.years_of_experience),
  })

  return { error: error?.message ?? null }
}

export async function updateSkill(
  userId: string,
  id: string,
  input: SkillInput,
): Promise<{ error: string | null }> {
  const validationError = validateSkillInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('skills')
    .update({
      skill_name: input.skill_name.trim(),
      proficiency_level: trimOrNull(input.proficiency_level),
      years_of_experience: parseYearsExperience(input.years_of_experience),
    })
    .eq('id', id)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deleteSkill(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('skills').delete().eq('id', id).eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function createLanguage(
  userId: string,
  input: LanguageInput,
): Promise<{ error: string | null }> {
  const validationError = validateLanguageInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase.from('languages').insert({
    user_id: userId,
    language_name: input.language_name.trim(),
    proficiency: trimOrNull(input.proficiency),
  })

  return { error: error?.message ?? null }
}

export async function updateLanguage(
  userId: string,
  id: string,
  input: LanguageInput,
): Promise<{ error: string | null }> {
  const validationError = validateLanguageInput(input)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('languages')
    .update({
      language_name: input.language_name.trim(),
      proficiency: trimOrNull(input.proficiency),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deleteLanguage(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('languages').delete().eq('id', id).eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function updateProfileInterests(
  userId: string,
  interests: string[],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ interests })
    .eq('id', userId)

  return { error: error?.message ?? null }
}

export async function updateProfileAbout(
  userId: string,
  input: AboutInput,
): Promise<{ error: string | null }> {
  const patch: Record<string, string | null> = {
    headline: trimOrNull(input.headline),
    bio: trimOrNull(input.bio),
    occupation: trimOrNull(input.occupation),
    industry: trimOrNull(input.industry),
    business_name: trimOrNull(input.business_name),
    location: trimOrNull(input.location),
  }

  // Only update the name when a non-empty value is supplied — a profile must
  // always keep a name, so we never null it out.
  const fullName = input.full_name?.trim()
  if (fullName) {
    patch.full_name = fullName
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)

  return { error: error?.message ?? null }
}

/**
 * Update the signed-in user's profile picture and/or cover image URLs. Pass
 * only the field(s) you want to change.
 *
 * Uses `.select()` so a silent 0-row RLS miss is reported as an error instead of
 * looking like success while the UI keeps showing initials.
 */
export async function updateProfileImages(
  userId: string,
  input: { avatar_url?: string; cover_url?: string },
): Promise<{ error: string | null; data?: { avatar_url: string | null; cover_url: string | null } }> {
  const patch: Record<string, string> = {}
  if (input.avatar_url !== undefined) {
    const url = input.avatar_url.trim()
    if (!url) return { error: 'Avatar URL is empty.' }
    patch.avatar_url = url
  }
  if (input.cover_url !== undefined) {
    const url = input.cover_url.trim()
    if (!url) return { error: 'Cover URL is empty.' }
    patch.cover_url = url
  }
  if (Object.keys(patch).length === 0) return { error: null }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('avatar_url, cover_url')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'Could not save photo to your profile. Please try again.' }
  return { error: null, data }
}

export const EMPTY_EXPERIENCE_INPUT: ExperienceInput = {
  title: '',
  company_name: '',
  employment_type: '',
  location: '',
  location_type: '',
  start_date: '',
  end_date: '',
  is_current: false,
  description: '',
  industry: '',
  skills: '',
}

export const EMPTY_EDUCATION_INPUT: EducationInput = {
  school: '',
  degree: '',
  field_of_study: '',
  start_year: '',
  end_year: '',
  grade: '',
  activities: '',
  description: '',
  location: '',
  skills: '',
}

export const EMPTY_SKILL_INPUT: SkillInput = {
  skill_name: '',
  proficiency_level: '',
  years_of_experience: '',
}

export const EMPTY_LANGUAGE_INPUT: LanguageInput = {
  language_name: '',
  proficiency: '',
}
