/**
 * Zod validation for order issues.
 *
 * Migrated from the issue slice of the legacy `lib/utils/orders/validators.js`
 * (`validateOrderIssueData`) — same rules (order id, issue type, a description
 * of at least 10 characters, and a reporter), expressed as a Zod schema.
 */

import { z } from 'zod'

import { ISSUE_PRIORITY, ISSUE_STATUS, ORDER_ISSUE_TYPE } from './order.constants'

const issueStatusValues = Object.values(ISSUE_STATUS) as [string, ...string[]]
const issueTypeValues = Object.values(ORDER_ISSUE_TYPE) as [string, ...string[]]
const issuePriorityValues = Object.values(ISSUE_PRIORITY) as [string, ...string[]]

export const issueStatusSchema = z.enum(issueStatusValues)
export const issueTypeSchema = z.enum(issueTypeValues)
export const issuePrioritySchema = z.enum(issuePriorityValues)

/** Mirrors the legacy `validateOrderIssueData`. */
export const orderIssueSchema = z.object({
  order_id: z.string().uuid('A valid order is required.'),
  order_item_id: z.string().uuid().nullish(),
  issue_type: z.string().min(1, 'Issue type is required.'),
  subject: z.string().trim().max(200, 'Subject is too long.').nullish(),
  description: z.string().trim().min(10, 'Issue description must be at least 10 characters.'),
  reported_by: z.string().uuid('A valid reporter is required.').nullish(),
  priority: z.string().optional(),
  attachments: z.array(z.string()).optional(),
})

export type IssueValidationResult = { isValid: boolean; errors: string[] }

function zodErrorToList(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message)
}

/**
 * Validate issue creation data. Returns the legacy `{ isValid, errors[] }` shape
 * so the service can surface `errors.join(', ')` exactly as before.
 *
 * `reported_by` is validated as optional here because the service fills it from
 * the authenticated session when omitted.
 */
export function validateOrderIssueData(data: unknown): IssueValidationResult {
  const result = orderIssueSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: [] }
  return { isValid: false, errors: zodErrorToList(result.error) }
}
