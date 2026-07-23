/**
 * CMS validation schemas (Zod) + field validators for `useFormValidation`.
 * Limits match the DB columns in `cms_setup` (not inflated beyond VARCHAR sizes).
 */

import { compose, maxLength, minLength, required, type Validator } from '~/lib/validation'

import {
  CMS_BODY_FORMATS,
  CMS_CONTENT_STATUSES,
  CMS_CONTENT_TYPES,
  CMS_MEDIA_BUCKETS,
  CMS_OG_TYPES,
  CMS_REDIRECT_CODES,
  CMS_SITEMAP_CHANGEFREQS,
  CMS_TWITTER_CARDS,
  CMS_VALIDATION,
  type CmsValidationResult,
} from './cms.type'
import { z } from '~/lib/zod'

// ============= HELPERS =============

const trimString = (schema: z.ZodString) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema)

const uuidSchema = z.string().uuid('Must be a valid UUID')
const optionalUuid = uuidSchema.optional().nullable()
const urlSchema = z
  .string()
  .url('Must be a valid URL (include https://)')
  .optional()
  .nullable()
const timestampSchema = z.string().datetime({ offset: true }).optional().nullable()

const contentTypeValues = [
  CMS_CONTENT_TYPES.POST,
  CMS_CONTENT_TYPES.PAGE,
  CMS_CONTENT_TYPES.PRODUCT,
  CMS_CONTENT_TYPES.ANNOUNCEMENT,
] as const

const contentStatusValues = [
  CMS_CONTENT_STATUSES.DRAFT,
  CMS_CONTENT_STATUSES.REVIEW,
  CMS_CONTENT_STATUSES.SCHEDULED,
  CMS_CONTENT_STATUSES.PUBLISHED,
  CMS_CONTENT_STATUSES.ARCHIVED,
] as const

// ============= FIELD VALIDATORS =============

export const cmsTitleValidator: Validator = compose(
  required('Title is required.'),
  minLength(CMS_VALIDATION.CONTENT_TITLE.MIN, 'Title is required.'),
  maxLength(
    CMS_VALIDATION.CONTENT_TITLE.MAX,
    `Title must be ${CMS_VALIDATION.CONTENT_TITLE.MAX} characters or fewer.`,
  ),
)

export const cmsSlugValidator: Validator = compose(
  required('Slug is required.'),
  (value) =>
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
      ? null
      : 'Slug must be lowercase alphanumeric with hyphens.',
)

export const cmsCategoryNameValidator: Validator = compose(
  required('Name is required.'),
  maxLength(
    CMS_VALIDATION.CATEGORY_NAME.MAX,
    `Name must be ${CMS_VALIDATION.CATEGORY_NAME.MAX} characters or fewer.`,
  ),
)

export const cmsCommentBodyValidator: Validator = compose(
  required('Comment cannot be empty.'),
  maxLength(
    CMS_VALIDATION.COMMENT_BODY.MAX,
    `Comment must be ${CMS_VALIDATION.COMMENT_BODY.MAX} characters or fewer.`,
  ),
)

// ============= CATEGORY =============

export const createCategorySchema = z.object({
  name: trimString(
    z
      .string()
      .min(CMS_VALIDATION.CATEGORY_NAME.MIN, 'Name is required')
      .max(CMS_VALIDATION.CATEGORY_NAME.MAX, 'Name must be 100 characters or fewer'),
  ),
  slug: trimString(
    z
      .string()
      .max(CMS_VALIDATION.CATEGORY_SLUG.MAX)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase alphanumeric with hyphens (e.g. my-post-title)',
      }),
  ),
  description: trimString(z.string().max(CMS_VALIDATION.CATEGORY_DESCRIPTION.MAX))
    .optional()
    .nullable(),
  parent_id: optionalUuid,
  cover_url: urlSchema,
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

export const updateCategorySchema = createCategorySchema.partial()

// ============= TAG =============

export const createTagSchema = z.object({
  name: trimString(
    z
      .string()
      .min(CMS_VALIDATION.TAG_NAME.MIN, 'Tag name is required')
      .max(CMS_VALIDATION.TAG_NAME.MAX, 'Tag name must be 60 characters or fewer'),
  ),
  slug: trimString(
    z
      .string()
      .max(CMS_VALIDATION.TAG_SLUG.MAX)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase alphanumeric with hyphens (e.g. my-post-title)',
      }),
  ),
})

export const updateTagSchema = createTagSchema.partial()

// ============= MEDIA =============

export const createMediaSchema = z.object({
  file_name: trimString(
    z.string().min(1, 'File name is required').max(255, 'File name must be 255 characters or fewer'),
  ),
  file_size: z.number().int().positive('File size must be a positive number'),
  mime_type: z.string().min(1, 'MIME type is required').max(100),
  media_type: z.enum(['image', 'video', 'document', 'audio', 'other']),
  bucket_id: z.enum([CMS_MEDIA_BUCKETS.PUBLIC, CMS_MEDIA_BUCKETS.PRIVATE]),
  storage_path: z.string().min(1, 'Storage path is required').max(2000),
  public_url: urlSchema,
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  alt_text: trimString(z.string().max(500)).optional().nullable(),
  caption: trimString(z.string().max(1000)).optional().nullable(),
  folder: z.string().max(255).default('/'),
  is_active: z.boolean().default(true),
})

export const updateMediaSchema = createMediaSchema
  .partial()
  .omit({ bucket_id: true, storage_path: true })

// ============= CONTENT SEO EXTENSION =============

const seoExtensionSchema = z.object({
  seo_title: trimString(z.string().max(CMS_VALIDATION.SEO_TITLE.MAX)).optional().nullable(),
  seo_description: trimString(z.string().max(CMS_VALIDATION.SEO_DESCRIPTION.MAX))
    .optional()
    .nullable(),
  seo_keywords: z.array(trimString(z.string().max(100))).optional().nullable(),
  canonical_url: urlSchema,
  focus_keyword: trimString(z.string().max(CMS_VALIDATION.FOCUS_KEYWORD.MAX)).optional().nullable(),
  og_title: trimString(z.string().max(300)).optional().nullable(),
  og_description: trimString(z.string().max(200)).optional().nullable(),
  og_image_id: optionalUuid,
  og_type: z.enum(CMS_OG_TYPES).default('article'),
  twitter_card: z.enum(CMS_TWITTER_CARDS).default('summary_large_image'),
  twitter_title: trimString(z.string().max(300)).optional().nullable(),
  twitter_description: trimString(z.string().max(200)).optional().nullable(),
  twitter_image_id: optionalUuid,
  robots_index: z.boolean().default(true),
  robots_follow: z.boolean().default(true),
  robots_extra: trimString(z.string().max(100)).optional().nullable(),
  schema_org: z.array(z.record(z.string(), z.unknown())).default([]),
  sitemap_priority: z.number().min(0).max(1).default(0.5),
  sitemap_changefreq: z.enum(CMS_SITEMAP_CHANGEFREQS).default('weekly'),
  sitemap_exclude: z.boolean().default(false),
})

export const createContentSchema = seoExtensionSchema.extend({
  type: z.enum(contentTypeValues).default(CMS_CONTENT_TYPES.POST),
  status: z.enum(contentStatusValues).default(CMS_CONTENT_STATUSES.DRAFT),
  title: trimString(
    z
      .string()
      .min(CMS_VALIDATION.CONTENT_TITLE.MIN, 'Title is required')
      .max(CMS_VALIDATION.CONTENT_TITLE.MAX, 'Title must be 300 characters or fewer'),
  ),
  slug: trimString(
    z
      .string()
      .max(CMS_VALIDATION.CONTENT_SLUG.MAX)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'Slug must be lowercase alphanumeric with hyphens (e.g. my-post-title)',
      }),
  ),
  excerpt: trimString(z.string().max(CMS_VALIDATION.CONTENT_EXCERPT.MAX)).optional().nullable(),
  body: z.string().optional().nullable(),
  body_format: z.enum(CMS_BODY_FORMATS).default('markdown'),
  cover_image_id: optionalUuid,
  category_id: optionalUuid,
  vendor_id: optionalUuid,
  scheduled_at: timestampSchema,
  is_featured: z.boolean().default(false),
  allow_comments: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
  tag_ids: z.array(uuidSchema).optional().default([]),
  change_note: trimString(z.string().max(CMS_VALIDATION.NOTE.MAX)).optional().nullable(),
})

export const updateContentSchema = createContentSchema.partial()
export const publishContentSchema = z.object({ published_at: timestampSchema })

// ============= VERSION / COMMENT / LIKE =============

export const createVersionSchema = z.object({
  content_id: uuidSchema,
  title: trimString(
    z
      .string()
      .min(1, 'Title is required')
      .max(CMS_VALIDATION.CONTENT_TITLE.MAX, 'Title must be 300 characters or fewer'),
  ),
  body: z.string().optional().nullable(),
  body_format: z.enum(CMS_BODY_FORMATS).default('markdown'),
  status: z.enum(contentStatusValues),
  change_note: trimString(z.string().max(CMS_VALIDATION.NOTE.MAX)).optional().nullable(),
})

export const createCommentSchema = z.object({
  content_id: uuidSchema,
  parent_id: optionalUuid,
  body: trimString(
    z
      .string()
      .min(CMS_VALIDATION.COMMENT_BODY.MIN, 'Comment cannot be empty')
      .max(CMS_VALIDATION.COMMENT_BODY.MAX, 'Comment must be 2000 characters or fewer'),
  ),
})

export const updateCommentSchema = z.object({
  body: trimString(
    z
      .string()
      .min(CMS_VALIDATION.COMMENT_BODY.MIN, 'Comment cannot be empty')
      .max(CMS_VALIDATION.COMMENT_BODY.MAX, 'Comment must be 2000 characters or fewer'),
  ),
})

export const moderateCommentSchema = z.object({
  is_approved: z.boolean().optional(),
  is_flagged: z.boolean().optional(),
  deleted_at: timestampSchema,
})

export const toggleLikeSchema = z.object({ content_id: uuidSchema })

// ============= SEO / REDIRECTS =============

const seoFieldsSchema = z.object({
  content_id: optionalUuid,
  category_id: optionalUuid,
  custom_path: trimString(z.string().max(CMS_VALIDATION.REDIRECT_PATH.MAX)).optional().nullable(),
  meta_title: trimString(
    z
      .string()
      .min(CMS_VALIDATION.META_TITLE.MIN, 'Meta title is required')
      .max(CMS_VALIDATION.META_TITLE.MAX, 'Meta title must be 60 characters or fewer'),
  ),
  meta_description: trimString(z.string().max(CMS_VALIDATION.META_DESCRIPTION.MAX))
    .optional()
    .nullable(),
  focus_keyword: trimString(z.string().max(CMS_VALIDATION.FOCUS_KEYWORD.MAX)).optional().nullable(),
  canonical_url: urlSchema,
  robots_index: z.boolean().default(true),
  robots_follow: z.boolean().default(true),
  robots_extra: trimString(z.string().max(100)).optional().nullable(),
  og_title: trimString(z.string().max(300)).optional().nullable(),
  og_description: trimString(z.string().max(500)).optional().nullable(),
  og_image_id: optionalUuid,
  og_type: z.enum(CMS_OG_TYPES).default('website'),
  twitter_card: z.enum(CMS_TWITTER_CARDS).default('summary_large_image'),
  twitter_title: trimString(z.string().max(300)).optional().nullable(),
  twitter_description: trimString(z.string().max(200)).optional().nullable(),
  twitter_image_id: optionalUuid,
  schema_org: z.array(z.record(z.string(), z.unknown())).default([]),
  sitemap_priority: z.number().min(0).max(1).default(0.5),
  sitemap_changefreq: z.enum(CMS_SITEMAP_CHANGEFREQS).default('weekly'),
  sitemap_exclude: z.boolean().default(false),
})

export const createSeoSchema = seoFieldsSchema.refine(
  (d) => [d.content_id, d.category_id, d.custom_path].filter(Boolean).length === 1,
  {
    message: 'Exactly one of content_id, category_id, or custom_path must be provided',
  },
)

export const updateSeoSchema = seoFieldsSchema
  .partial()
  .omit({ content_id: true, category_id: true, custom_path: true })

export const createRedirectSchema = z.object({
  from_path: trimString(
    z
      .string()
      .min(1, 'Source path is required')
      .max(CMS_VALIDATION.REDIRECT_PATH.MAX)
      .refine((v) => v.startsWith('/'), { message: 'from_path must start with /' }),
  ),
  to_path: trimString(
    z
      .string()
      .max(CMS_VALIDATION.REDIRECT_PATH.MAX)
      .refine((v) => !v || v.startsWith('/') || v.startsWith('http'), {
        message: 'to_path must start with / or be an absolute URL (https://…)',
      }),
  )
    .optional()
    .nullable(),
  redirect_code: z
    .number()
    .refine((v) => (CMS_REDIRECT_CODES as readonly number[]).includes(v), {
      message: `Redirect code must be one of: ${CMS_REDIRECT_CODES.join(', ')}`,
    })
    .default(301),
  is_active: z.boolean().default(true),
  note: trimString(z.string().max(CMS_VALIDATION.NOTE.MAX)).optional().nullable(),
})

export const updateRedirectSchema = createRedirectSchema.partial()

// ============= LIST PARAMS =============

export const listContentParamsSchema = z.object({
  type: z.enum(contentTypeValues).optional(),
  status: z.enum(contentStatusValues).optional(),
  category_id: uuidSchema.optional(),
  author_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional(),
  is_featured: z.boolean().optional(),
  search: trimString(z.string().max(200)).optional(),
  tag_ids: z.array(uuidSchema).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  order_by: z
    .enum(['created_at', 'published_at', 'updated_at', 'like_count', 'view_count'])
    .default('created_at'),
  ascending: z.boolean().default(false),
})

export const listCommentsParamsSchema = z.object({
  content_id: uuidSchema,
  parent_id: uuidSchema.optional().nullable(),
  is_approved: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

// ============= PARSE HELPERS =============

export function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join('; ')
    throw new Error(messages)
  }
  return result.data
}

export function zodIssuesToList(error: z.ZodError): string[] {
  return error.issues.map((i) => i.message)
}

export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): CmsValidationResult & { data?: T } {
  const result = schema.safeParse(payload)
  if (!result.success) {
    return { isValid: false, errors: zodIssuesToList(result.error) }
  }
  return { isValid: true, errors: [], data: result.data }
}
