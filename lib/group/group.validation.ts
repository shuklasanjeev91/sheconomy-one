/**
 * Community Groups — Zod validation schemas + runners.
 */

import { z } from 'zod'

import { DEFAULT_GROUP_TYPE, GROUP_TYPE_OPTIONS } from './group.type'
import { normalizeGroupName, parseIndustriesInput } from './group.utils'

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

const industriesSchema = z
  .union([z.array(z.string()), z.string(), z.null()])
  .optional()
  .nullable()
  .transform((v) => parseIndustriesInput(v ?? null))

const groupTypeSchema = z
  .union([z.string().trim(), z.null()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v == null || !String(v).trim()) return DEFAULT_GROUP_TYPE
    return String(v).trim()
  })
  .refine(
    (val) => (GROUP_TYPE_OPTIONS as readonly string[]).includes(val) || val.length > 0,
    { message: 'Invalid group type' },
  )

const groupBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .transform(normalizeGroupName),
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string()
    .max(5000, 'Description cannot exceed 5000 characters')
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return null
      const t = v.trim()
      return t.length ? t : null
    }),
  avatar_url: optionalUrl,
  cover_url: optionalUrl,
  members_count: z.union([z.number().int().min(0), z.null()]).optional().nullable(),
  industries: industriesSchema,
  location: z
    .string()
    .max(100, 'Location cannot exceed 100 characters')
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return null
      const t = v.trim()
      return t.length ? t : null
    }),
  rules: optionalText,
  group_type: groupTypeSchema,
  allow_invites: z.boolean().optional().nullable(),
  require_post_review: z.boolean().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  raw_group_data: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const createGroupSchema = groupBaseSchema

export const updateGroupSchema = groupBaseSchema.partial()

export const groupListFiltersSchema = z.object({
  search: z.string().optional(),
  group_type: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  created_by: z.string().uuid().optional(),
})

export const groupListParamsSchema = z.object({
  filters: groupListFiltersSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  orderBy: z
    .enum(['created_at', 'updated_at', 'members_count', 'name', 'title'])
    .optional()
    .default('created_at'),
  ascending: z.boolean().optional().default(false),
})

export const setGroupMemberRoleSchema = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'member']),
})

export const respondJoinRequestSchema = z.object({
  request_id: z.string().uuid(),
  group_id: z.string().uuid(),
  approve: z.boolean(),
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

export type CreateGroupSchema = z.infer<typeof createGroupSchema>
export type UpdateGroupSchema = z.infer<typeof updateGroupSchema>
