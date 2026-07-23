import { z } from 'zod'

import type { CustomPartnerFormInput, CustomPartnerInput } from './vendor-shipping.type'

const pickupAddressSchema = z.object({
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
})

export const connectShiprocketSchema = z.object({
  email: z.string().trim().email('Enter a valid Shiprocket email.'),
  password: z.string().min(1, 'Password is required.'),
})

export const customPartnerSchema = z.object({
  partner_name: z.string().trim().min(1, 'Partner name is required.'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  website: z.union([z.string().url(), z.literal('')]).optional(),
  tracking_url_template: z.string().optional(),
  pickup_address: pickupAddressSchema.optional(),
  service_areas: z.array(z.string()).optional(),
})

export function validateConnectShiprocket(data: { email: string; password: string }) {
  const result = connectShiprocketSchema.safeParse(data)
  if (result.success) return { isValid: true as const, errors: [] as string[] }
  return {
    isValid: false as const,
    errors: result.error.issues.map((issue) => issue.message),
  }
}

export function validateCustomPartnerInput(data: CustomPartnerFormInput | CustomPartnerInput) {
  const result = customPartnerSchema.safeParse(data)
  if (result.success) return { isValid: true as const, errors: [] as string[], data: result.data }
  return {
    isValid: false as const,
    errors: result.error.issues.map((issue) => issue.message),
    data: null,
  }
}

export function formToCustomPartnerInput(form: CustomPartnerFormInput): CustomPartnerInput {
  return {
    partner_name: form.partner_name.trim(),
    contact_person: form.contact_person.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    website: form.website.trim() || null,
    tracking_url_template: form.tracking_url_template.trim() || null,
    pickup_address: form.pickup_address,
    service_areas: form.service_areas,
  }
}
