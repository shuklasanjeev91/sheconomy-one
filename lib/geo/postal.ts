import { resolveCountryCode } from '~/lib/geo/data'

const POSTAL_RULES: Record<string, RegExp> = {
  IN: /^[1-9]\d{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/,
  AU: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  SG: /^\d{6}$/,
  AE: /^\d{5}$/,
}

export function normalizePostalCode(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function getPostalCodeLabel(countryCode: string): string {
  const code = resolveCountryCode(countryCode)
  if (code === 'IN') return 'PIN code'
  if (code === 'US') return 'ZIP code'
  if (code === 'GB') return 'Postcode'
  return 'Postal code'
}

export function getPostalCodePlaceholder(countryCode: string): string {
  const code = resolveCountryCode(countryCode)
  if (code === 'IN') return '6-digit PIN'
  if (code === 'US') return '12345 or 12345-6789'
  if (code === 'GB') return 'SW1A 1AA'
  if (code === 'CA') return 'A1A 1A1'
  return 'Postal code'
}

export function validatePostalCode(countryCode: string, value: string): string | null {
  const postal = normalizePostalCode(value).replace(/\s/g, '')
  if (!postal) {
    return 'Enter a valid postal code.'
  }

  const code = resolveCountryCode(countryCode)
  const rule = POSTAL_RULES[code]
  if (rule) {
    return rule.test(postal) ? null : `Enter a valid ${getPostalCodeLabel(code).toLowerCase()}.`
  }

  if (postal.length < 3 || postal.length > 12) {
    return 'Enter a valid postal code.'
  }

  return /^[A-Za-z0-9 -]+$/.test(postal) ? null : 'Enter a valid postal code.'
}
