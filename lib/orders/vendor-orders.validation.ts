/**
 * Zod validation for vendor order mutations.
 *
 * Validates shapes at the boundary (store thunks / forms). Status-machine
 * validation (which transitions are legal) lives in `order.utils` and is
 * applied by the service against the item's *current* status.
 */

import { ORDER_STATUS, PAYMENT_MODE } from '~/lib/orders/order.constants'
import { z } from '~/lib/zod'

const orderStatusValues = Object.values(ORDER_STATUS) as [string, ...string[]]
export const orderStatusSchema = z.enum(orderStatusValues)

export const paymentModeValues = Object.values(PAYMENT_MODE) as [string, ...string[]]

// ============= MUTATIONS =============

export const itemStatusUpdateSchema = z.object({
  orderItemId: z.string().uuid('A valid order item is required.'),
  newStatus: orderStatusSchema,
  note: z.string().trim().max(500, 'Note is too long.').nullish(),
})

export const bulkStatusUpdateSchema = z.object({
  orderItemIds: z
    .array(z.string().uuid('A valid order item is required.'))
    .min(1, 'Select at least one order item.'),
  newStatus: orderStatusSchema,
  note: z.string().trim().max(500, 'Note is too long.').nullish(),
})

export const vendorItemFieldsUpdateSchema = z.object({
  orderItemId: z.string().uuid('A valid order item is required.'),
  updates: z
    .object({
      item_status: orderStatusSchema.optional(),
      digital_download_url: z.string().url('Enter a valid URL.').nullish(),
      download_expires_at: z.string().datetime({ offset: true }).nullish(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'No valid vendor fields to update.',
    }),
})

// ============= QUERY / FILTERS =============

export const vendorOrderFiltersSchema = z.object({
  status: orderStatusSchema.nullish(),
  order_number: z.string().trim().nullish(),
  date_from: z.string().nullish(),
  date_to: z.string().nullish(),
})

export const vendorOrderPaginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  order_by: z.enum(['created_at', 'updated_at', 'total_price', 'quantity']).optional(),
  order_direction: z.enum(['asc', 'desc']).optional(),
})

// ============= RESULT HELPERS =============

export type OrderValidationResult = { isValid: boolean; errors: Record<string, string> }

function zodErrorToMap(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : 'form'
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}

/** Validate an item status update payload; returns the profile/shop-style result. */
export function validateItemStatusUpdate(data: unknown): OrderValidationResult {
  const result = itemStatusUpdateSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}

export function validateBulkStatusUpdate(data: unknown): OrderValidationResult {
  const result = bulkStatusUpdateSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}

export function validateVendorItemFieldsUpdate(data: unknown): OrderValidationResult {
  const result = vendorItemFieldsUpdateSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: {} }
  return { isValid: false, errors: zodErrorToMap(result.error) }
}
