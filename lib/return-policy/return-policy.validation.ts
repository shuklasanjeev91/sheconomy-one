import { z } from 'zod'

import {
  DEFAULT_RETURN_POLICY_VALUES,
  RETURN_POLICY_VALIDATION,
  RETURN_SHIPPING_PAID_BY_VALUES,
} from './return-policy.constants'
import type {
  ReturnPolicyFormData,
  ReturnPolicyInput,
  ReturnPolicyValidationResult,
} from './return-policy.type'

// ============= ZOD SCHEMAS =============

export const returnShippingPaidBySchema = z.enum(RETURN_SHIPPING_PAID_BY_VALUES)

export const returnPolicyInputSchema = z.object({
  policy_name: z
    .string()
    .trim()
    .min(
      RETURN_POLICY_VALIDATION.POLICY_NAME.MIN_LENGTH,
      'Policy name is required.',
    )
    .max(
      RETURN_POLICY_VALIDATION.POLICY_NAME.MAX_LENGTH,
      `Policy name must be ${RETURN_POLICY_VALIDATION.POLICY_NAME.MAX_LENGTH} characters or less.`,
    ),
  is_default: z.boolean().optional(),
  return_window_days: z
    .coerce
    .number()
    .int()
    .min(
      RETURN_POLICY_VALIDATION.RETURN_WINDOW_DAYS.MIN,
      `Return window must be at least ${RETURN_POLICY_VALIDATION.RETURN_WINDOW_DAYS.MIN} day.`,
    )
    .max(
      RETURN_POLICY_VALIDATION.RETURN_WINDOW_DAYS.MAX,
      `Return window must be ${RETURN_POLICY_VALIDATION.RETURN_WINDOW_DAYS.MAX} days or less.`,
    )
    .default(DEFAULT_RETURN_POLICY_VALUES.RETURN_WINDOW_DAYS),
  accepts_returns: z.boolean().default(DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_RETURNS),
  accepts_exchanges: z.boolean().default(DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_EXCHANGES),
  accepts_refunds: z.boolean().default(DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_REFUNDS),
  condition_description: z
    .string()
    .max(
      RETURN_POLICY_VALIDATION.CONDITION_DESCRIPTION.MAX_LENGTH,
      `Condition description must be ${RETURN_POLICY_VALIDATION.CONDITION_DESCRIPTION.MAX_LENGTH} characters or less.`,
    )
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
  return_shipping_paid_by: returnShippingPaidBySchema
    .nullable()
    .optional()
    .default(DEFAULT_RETURN_POLICY_VALUES.RETURN_SHIPPING_PAID_BY),
  policy_details: z
    .string()
    .max(
      RETURN_POLICY_VALIDATION.POLICY_DETAILS.MAX_LENGTH,
      `Policy details must be ${RETURN_POLICY_VALIDATION.POLICY_DETAILS.MAX_LENGTH} characters or less.`,
    )
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null),
  is_active: z.boolean().default(DEFAULT_RETURN_POLICY_VALUES.IS_ACTIVE),
})

export const returnPolicyFormSchema = returnPolicyInputSchema

export const returnPolicyUpdateSchema = returnPolicyInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required to update a return policy.' },
)

export const assignReturnPolicySchema = z.object({
  listingId: z.string().uuid('A valid listing is required.'),
  returnPolicyId: z.string().uuid('A valid return policy is required.'),
})

export const removeReturnPolicySchema = assignReturnPolicySchema

// ============= VALIDATION HELPERS =============

function zodErrorsToResult(error: z.ZodError): ReturnPolicyValidationResult {
  const errors: Record<string, string> = {}
  const fieldErrors: string[] = []

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!errors[key]) errors[key] = issue.message
    fieldErrors.push(issue.message)
  }

  return { isValid: false, errors, fieldErrors }
}

export function validateReturnPolicyInput(
  input: ReturnPolicyInput | ReturnPolicyFormData,
): ReturnPolicyValidationResult {
  const parsed = returnPolicyInputSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function validateReturnPolicyUpdate(
  input: Partial<ReturnPolicyInput>,
): ReturnPolicyValidationResult {
  const parsed = returnPolicyUpdateSchema.safeParse(input)
  if (parsed.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToResult(parsed.error)
}

export function parseReturnPolicyInput(input: ReturnPolicyInput | ReturnPolicyFormData) {
  return returnPolicyInputSchema.parse(input)
}

export function parseReturnPolicyUpdate(input: Partial<ReturnPolicyInput>) {
  return returnPolicyUpdateSchema.parse(input)
}

export function buildDefaultReturnPolicyFormData(
  shopName?: string | null,
): ReturnPolicyFormData {
  const name = shopName?.trim() || 'Shop'
  return {
    policy_name: `${name} Return Policy`,
    is_default: DEFAULT_RETURN_POLICY_VALUES.IS_DEFAULT,
    return_window_days: DEFAULT_RETURN_POLICY_VALUES.RETURN_WINDOW_DAYS,
    accepts_returns: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_RETURNS,
    accepts_exchanges: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_EXCHANGES,
    accepts_refunds: DEFAULT_RETURN_POLICY_VALUES.ACCEPTS_REFUNDS,
    return_shipping_paid_by: DEFAULT_RETURN_POLICY_VALUES.RETURN_SHIPPING_PAID_BY,
    condition_description: DEFAULT_RETURN_POLICY_VALUES.CONDITION_DESCRIPTION,
    policy_details: DEFAULT_RETURN_POLICY_VALUES.POLICY_DETAILS,
    is_active: DEFAULT_RETURN_POLICY_VALUES.IS_ACTIVE,
  }
}
