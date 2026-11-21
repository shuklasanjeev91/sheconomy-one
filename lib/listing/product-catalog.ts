/**
 * Etsy-style listing helpers: who made it, personalization, and sale price.
 * Pure functions — no Supabase — so seller validation can be unit-tested.
 */

export const WHO_MADE_OPTIONS = [
  { value: 'i_did', label: 'I did' },
  { value: 'collective', label: 'A member of my shop' },
  { value: 'someone_else', label: 'Another company or person' },
] as const

export const WHEN_MADE_OPTIONS = [
  { value: 'made_to_order', label: 'Made to order' },
  { value: '2020s', label: '2020 – 2026' },
  { value: '2010s', label: '2010 – 2019' },
  { value: '2000s', label: '2000 – 2009' },
  { value: 'before_2000', label: 'Before 2000' },
  { value: 'vintage', label: 'Vintage' },
] as const

export const WHAT_IS_IT_OPTIONS = [
  { value: 'finished_product', label: 'A finished product' },
  { value: 'supply_or_tool', label: 'A supply or tool to make things' },
] as const

export type WhoMade = (typeof WHO_MADE_OPTIONS)[number]['value']
export type WhenMade = (typeof WHEN_MADE_OPTIONS)[number]['value']
export type WhatIsIt = (typeof WHAT_IS_IT_OPTIONS)[number]['value']

export const MAX_VARIATION_PROPERTIES = 2
export const MAX_LISTING_TAGS = 13
export const MAX_LISTING_PHOTOS = 10
export const PERSONALIZATION_CHAR_LIMIT = { MIN: 1, MAX: 1024 } as const

export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  return options.find((row) => row.value === value)?.label ?? ''
}

export function whoMadeLabel(value: string | null | undefined): string {
  return optionLabel(WHO_MADE_OPTIONS, value)
}

export function whenMadeLabel(value: string | null | undefined): string {
  return optionLabel(WHEN_MADE_OPTIONS, value)
}

export function whatIsItLabel(value: string | null | undefined): string {
  return optionLabel(WHAT_IS_IT_OPTIONS, value)
}

export type PersonalizationDraft = {
  personalization_enabled?: boolean | null
  personalization_instructions?: string | null
  personalization_char_limit?: number | string | null
  personalization_required?: boolean | null
}

/** Publish gates for the personalization block. Off listings have no extra fields. */
export function validatePersonalization(draft: PersonalizationDraft): Record<string, string> {
  if (!draft.personalization_enabled) return {}
  const errors: Record<string, string> = {}
  const instructions = (draft.personalization_instructions ?? '').trim()
  if (!instructions) {
    errors.personalization_instructions = 'Tell buyers what to enter.'
  }
  const limit = Number(draft.personalization_char_limit)
  if (
    !Number.isFinite(limit) ||
    limit < PERSONALIZATION_CHAR_LIMIT.MIN ||
    limit > PERSONALIZATION_CHAR_LIMIT.MAX
  ) {
    errors.personalization_char_limit = `Character limit must be between ${PERSONALIZATION_CHAR_LIMIT.MIN} and ${PERSONALIZATION_CHAR_LIMIT.MAX}.`
  }
  return errors
}

export type CompletenessInput = {
  listingType?: string | null
  title?: string | null
  whoMade?: string | null
  whenMade?: string | null
  whatIsIt?: string | null
}

/** Short inventory hint. Empty when the handmade details are filled in. */
export function listingCompletenessHint(input: CompletenessInput): string | null {
  if (input.listingType && input.listingType !== 'physical' && input.listingType !== 'digital') {
    return null
  }
  if (!input.title?.trim()) return 'Add a title'
  if (!input.whoMade || !input.whenMade || !input.whatIsIt) return 'Say who made it'
  return null
}

export function saleWindowActive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const start = startsAt?.trim() ? Date.parse(startsAt) : null
  const end = endsAt?.trim() ? Date.parse(endsAt) : null
  if (start != null && Number.isNaN(start)) return false
  if (end != null && Number.isNaN(end)) return false
  if (start != null && now.getTime() < start) return false
  if (end != null && now.getTime() > end) return false
  return start != null || end != null
}

/** Selling price during an active sale window; otherwise the offer price. */
export function effectiveUnitPrice(
  price: number,
  salePrice: number | null | undefined,
  startsAt?: string | null,
  endsAt?: string | null,
  now: Date = new Date(),
): number {
  const sale = salePrice == null ? null : Number(salePrice)
  if (sale == null || !Number.isFinite(sale) || sale < 0 || sale >= price) return price
  if (!saleWindowActive(startsAt, endsAt, now)) return price
  return sale
}
