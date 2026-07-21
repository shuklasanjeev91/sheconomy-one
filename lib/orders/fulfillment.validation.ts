/**
 * Zod validation for fulfillment.
 *
 * Migrated from the fulfillment + carrier slices of the legacy
 * `lib/utils/orders/validators.js` (`validateFulfillmentData`,
 * `validateCarrierData`) — same rules, expressed as Zod schemas returning the
 * legacy `{ isValid, errors[] }` shape.
 */

import { FULFILLMENT_STATUS } from './order.constants'
import { z } from '~/lib/zod'

const fulfillmentStatusValues = Object.values(FULFILLMENT_STATUS) as [string, ...string[]]
export const fulfillmentStatusSchema = z.enum(fulfillmentStatusValues)

/** Mirrors the legacy `validateFulfillmentData`. */
export const fulfillmentSchema = z
  .object({
    order_item_id: z.string().min(1, 'Order item ID is required'),
    fulfilled_by: z.string().min(1, 'Fulfilled by ID is required'),
    quantity_to_fulfill: z.number().positive().optional(),
    quantity_fulfilled: z
      .number({ error: 'Quantity fulfilled must be a number' })
      .positive('Quantity fulfilled must be greater than 0')
      .optional(),
    estimated_ship_date: z.string().optional(),
    estimated_delivery_date: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.estimated_ship_date && data.estimated_delivery_date) {
        return new Date(data.estimated_ship_date) < new Date(data.estimated_delivery_date)
      }
      return true
    },
    { message: 'Estimated delivery date must be after estimated ship date', path: ['estimated_delivery_date'] },
  )

/** Mirrors the legacy `validateCarrierData`. */
export const carrierSchema = z
  .object({
    carrier_code: z.string().min(1, 'Carrier code is required'),
    carrier_name: z.string().min(1, 'Carrier name is required'),
    service_code: z.string().min(1, 'Service code is required'),
    service_name: z.string().min(1, 'Service name is required'),
    min_delivery_days: z.number().min(0, 'Minimum delivery days must be non-negative').optional(),
    max_delivery_days: z.number().min(0, 'Maximum delivery days must be non-negative').optional(),
    base_rate: z.number().min(0, 'Base rate must be non-negative').optional(),
    rate_per_kg: z.number().min(0, 'Rate per kg must be non-negative').optional(),
    fuel_surcharge_rate: z
      .number()
      .min(0, 'Fuel surcharge rate must be between 0 and 100')
      .max(100, 'Fuel surcharge rate must be between 0 and 100')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.min_delivery_days != null && data.max_delivery_days != null) {
        return data.min_delivery_days <= data.max_delivery_days
      }
      return true
    },
    {
      message: 'Minimum delivery days cannot be greater than maximum delivery days',
      path: ['max_delivery_days'],
    },
  )

export type FulfillmentValidationResult = { isValid: boolean; errors: string[] }

function zodErrorToList(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message)
}

export function validateFulfillmentData(data: unknown): FulfillmentValidationResult {
  const result = fulfillmentSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: [] }
  return { isValid: false, errors: zodErrorToList(result.error) }
}

export function validateCarrierData(data: unknown): FulfillmentValidationResult {
  const result = carrierSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: [] }
  return { isValid: false, errors: zodErrorToList(result.error) }
}
