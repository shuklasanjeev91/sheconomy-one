/**
 * Company Pages — Zod validation schemas + runners.
 */

import { z } from 'zod'

import {
  COMPANY_PAGE_CATEGORIES,
  COMPANY_PAGE_SIZES,
  COMPANY_PAGE_TYPES,
  DEFAULT_PAGE_CATEGORY,
} from '~/lib/company-page/company-page.type'
import { normalizeCompanyPageSlug } from '~/lib/company-page/company-page.utils'

const optionalUrl = z
  .union([z.string().url('Must be a valid URL'), z.literal(''), z.null()])
  .optional()
  .nullable()
  .transform((v) => (v === '' ? null : v))

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null) return null
    const t = v.trim()
    return t.length ? t : null
  })

const slugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(120, 'Slug cannot exceed 120 characters')
  .transform(normalizeCompanyPageSlug)
  .refine((val) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val), {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })

const foundedYearSchema = z
  .union([
    z.number().int().min(1800).max(new Date().getFullYear() + 1),
    z
      .string()
      .transform((v) => (v.trim() === '' ? null : parseInt(v, 10)))
      .pipe(z.number().int().min(1800).max(new Date().getFullYear() + 1).nullable()),
    z.null(),
  ])
  .optional()
  .nullable()

const sizeSchema = z
  .string()
  .trim()
  .min(1, 'Company size is required')
  .refine(
    (val) =>
      (COMPANY_PAGE_SIZES as readonly string[]).includes(val) || val.length > 0,
    { message: 'Invalid company size' },
  )

const typeSchema = z
  .string()
  .trim()
  .min(1, 'Company type is required')
  .refine(
    (val) =>
      (COMPANY_PAGE_TYPES as readonly string[]).includes(val) || val.length > 0,
    { message: 'Invalid company type' },
  )

const categorySchema = z
  .string()
  .trim()
  .min(1)
  .default(DEFAULT_PAGE_CATEGORY)
  .refine(
    (val) =>
      (COMPANY_PAGE_CATEGORIES as readonly string[]).includes(val) || val.length > 0,
    { message: 'Invalid page category' },
  )

const companyPageBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name cannot exceed 200 characters'),
  page_slug: slugSchema,
  industry: z
    .string()
    .trim()
    .min(2, 'Industry must be at least 2 characters')
    .max(120, 'Industry cannot exceed 120 characters'),
  size: sizeSchema,
  type: typeSchema,
  page_category: categorySchema,
  website: optionalUrl,
  logo_url: optionalUrl,
  cover_url: optionalUrl,
  tagline: z
    .string()
    .max(200, 'Tagline cannot exceed 200 characters')
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return null
      const t = v.trim()
      return t.length ? t : null
    }),
  headquarters: optionalText,
  location: optionalText,
  founded_year: foundedYearSchema,
  community_members: z
    .union([z.number().int().min(0), z.null()])
    .optional()
    .nullable(),
  created_by: z.string().uuid().optional().nullable(),
  raw_page_data: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const createCompanyPageSchema = companyPageBaseSchema

export const updateCompanyPageSchema = companyPageBaseSchema.partial()

export const companyPageListFiltersSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  type: z.string().optional(),
  page_category: z.string().optional(),
  location: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const companyPageListParamsSchema = z.object({
  filters: companyPageListFiltersSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
})

export const setMemberRoleSchema = z.object({
  company_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'member']),
})

export function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join(' | ')
    throw new Error(messages)
  }
  return result.data
}

export function validate<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): { success: boolean; data: T | null; errors: string[] | null } {
  const result = schema.safeParse(payload)
  if (result.success) return { success: true, data: result.data, errors: null }
  const errors = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
  return { success: false, data: null, errors }
}

export type CreateCompanyPageSchema = z.infer<typeof createCompanyPageSchema>
export type UpdateCompanyPageSchema = z.infer<typeof updateCompanyPageSchema>
