import {
  DEFAULT_COUNTRY,
  PHONE_COUNTRIES,
  countryFlag,
  type Country,
} from '~/lib/phone/countries'

const SORTED_BY_DIAL = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)

export function nationalDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function toE164Phone(country: Country, nationalNumber: string) {
  const digits = nationalDigits(nationalNumber)
  return `${country.dialCode}${digits}`
}

export function validateNationalPhone(nationalNumber: string, country: Country = DEFAULT_COUNTRY) {
  const digits = nationalDigits(nationalNumber)
  if (!digits) {
    return { ok: false as const, error: 'Enter your mobile number.' }
  }

  if (digits.length < country.minLength || digits.length > country.maxLength) {
    return {
      ok: false as const,
      error: `Enter a valid ${country.minLength}${
        country.maxLength !== country.minLength ? `–${country.maxLength}` : ''
      }-digit number for ${country.name}.`,
    }
  }

  if (!country.pattern.test(digits)) {
    return {
      ok: false as const,
      error: `Enter a valid mobile number for ${country.name}.`,
    }
  }

  return { ok: true as const, e164: toE164Phone(country, digits) }
}

export function normalizePhoneNumber(value: string, fallbackCountry: Country = DEFAULT_COUNTRY) {
  const trimmed = value.trim().replace(/[\s()-]/g, '')
  if (!trimmed) return ''

  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`

  const digits = nationalDigits(trimmed)
  if (!digits) return ''

  if (trimmed.startsWith('0') && digits.length === fallbackCountry.maxLength + 1) {
    return `${fallbackCountry.dialCode}${digits.slice(1)}`
  }

  if (digits.length >= fallbackCountry.minLength && digits.length <= fallbackCountry.maxLength) {
    return `${fallbackCountry.dialCode}${digits}`
  }

  return `+${digits}`
}

export function parseE164Phone(e164: string): { country: Country; nationalNumber: string } | null {
  const normalized = e164.startsWith('+') ? e164 : `+${nationalDigits(e164)}`
  const match = SORTED_BY_DIAL.find((country) => normalized.startsWith(country.dialCode))
  if (!match) return null

  const nationalNumber = normalized.slice(match.dialCode.length)
  return { country: match, nationalNumber }
}

export function isValidPhone(value: string, country: Country = DEFAULT_COUNTRY) {
  if (value.startsWith('+')) {
    const parsed = parseE164Phone(value)
    if (!parsed) return false
    return validateNationalPhone(parsed.nationalNumber, parsed.country).ok
  }

  return validateNationalPhone(value, country).ok
}

export function formatPhoneForDisplay(value: string, country?: Country) {
  if (value.startsWith('+')) {
    const parsed = parseE164Phone(value)
    if (parsed) {
      return `${countryFlag(parsed.country.iso2)} ${parsed.country.dialCode} ${parsed.nationalNumber}`
    }
    return value
  }

  const active = country ?? DEFAULT_COUNTRY
  const digits = nationalDigits(value)
  return `${countryFlag(active.iso2)} ${active.dialCode} ${digits}`
}
