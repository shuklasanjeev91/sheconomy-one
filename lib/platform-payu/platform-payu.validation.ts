import { z } from '~/lib/zod'

export const platformPayuInitiateSchema = z.object({
  order_id: z.string().uuid('A valid order is required.'),
  amount: z
    .number({ error: 'A valid payment amount is required.' })
    .positive('Amount must be greater than zero.'),
  productinfo: z.string().trim().min(1, 'Product info is required.').max(100),
  shop_id: z.string().uuid().optional(),
})

export type PlatformPayuInitiateInput = z.infer<typeof platformPayuInitiateSchema>

export function validatePlatformPayuInitiate(data: unknown): {
  success: boolean
  data?: PlatformPayuInitiateInput
  error?: string
} {
  const result = platformPayuInitiateSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  const message = result.error.issues.map((i) => i.message).join(' · ')
  return { success: false, error: message || 'Invalid payment request.' }
}
