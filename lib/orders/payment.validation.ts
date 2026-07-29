/**
 * Zod validation for order payments.
 *
 * Migrated from the payment slice of the legacy `lib/utils/orders/validators.js`
 * (`validatePaymentData`) — same rules (order id + positive amount + a valid
 * payment mode), now expressed as a Zod schema in this project's pattern.
 */

import { PAYMENT_MODE, PAYMENT_STATUS } from '~/lib/orders/order.constants'
import { z } from '~/lib/zod'

const paymentModeValues = Object.values(PAYMENT_MODE) as [string, ...string[]]
const paymentStatusValues = Object.values(PAYMENT_STATUS) as [string, ...string[]]

export const paymentModeSchema = z.enum(paymentModeValues)
export const paymentStatusSchema = z.enum(paymentStatusValues)

/** Mirrors the legacy `validatePaymentData`: order id, amount > 0, valid mode. */
export const paymentSchema = z.object({
  order_id: z.string().uuid('A valid order is required.'),
  amount: z
    .number({ error: 'A valid payment amount is required.' })
    .positive('A valid payment amount is required.'),
  payment_mode: paymentModeSchema,
})

export type PaymentValidationResult = { isValid: boolean; errors: string[] }

function zodErrorToList(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message)
}

/**
 * Validate payment data. Returns the legacy `{ isValid, errors[] }` shape so the
 * service can surface `errors.join(', ')` exactly as before.
 */
export function validatePaymentData(data: unknown): PaymentValidationResult {
  const result = paymentSchema.safeParse(data)
  if (result.success) return { isValid: true, errors: [] }
  return { isValid: false, errors: zodErrorToList(result.error) }
}
