import {
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js'

import {
  DEFAULT_COUNTRY,
  getAllPhoneCountries,
  countryFlag,
  findCountryByIso2,
  type Country,
} from '~/lib/phone/countries'

const SORTED_BY_DIAL = [...getAllPhoneCountries()].sort((a, b) => b.dialCode.length - a.dialCode.length)

export function nationalDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function toE164Phone(country: Country, nationalNumber: string) {
  const digits = nationalDigits(nationalNumber)
  const parsed = parsePhoneNumberFromString(digits, country.iso2 as CountryCode)
  if (parsed?.number) return parsed.number
  return `${country.dialCode}${digits}`
}

export function validateNationalPhone(nationalNumber: string, country: Country = DEFAULT_COUNTRY) {
  const digits = nationalDigits(nationalNumber)
  if (!digits) {
    return { ok: false as const, error: 'Enter your mobile number.' }
  }

  const parsed = parsePhoneNumberFromString(digits, country.iso2 as CountryCode)
  if (!parsed || !parsed.isValid()) {
    return {
      ok: false as const,
      error: `Enter a valid mobile number for ${country.name}.`,
    }
  }

  return { ok: true as const, e164: parsed.number }
}

export function normalizePhoneNumber(value: string, fallbackCountry: Country = DEFAULT_COUNTRY) {
  const trimmed = value.trim().replace(/[\s()-]/g, '')
  if (!trimmed) return ''

  const withPlus = trimmed.startsWith('+')
    ? trimmed
    : trimmed.startsWith('00')
      ? `+${trimmed.slice(2)}`
      : null

  if (withPlus) {
    const parsed = parsePhoneNumberFromString(withPlus)
    if (parsed?.isValid()) return parsed.number
    return withPlus
  }

  const digits = nationalDigits(trimmed)
  if (!digits) return ''

  const parsed = parsePhoneNumberFromString(digits, fallbackCountry.iso2 as CountryCode)
  if (parsed?.isValid()) return parsed.number

  if (trimmed.startsWith('0') && digits.length >= fallbackCountry.minLength) {
    const withoutTrunk = parsePhoneNumberFromString(digits.slice(1), fallbackCountry.iso2 as CountryCode)
    if (withoutTrunk?.isValid()) return withoutTrunk.number
  }

  return `+${digits}`
}

/** Normalize any stored/input phone to canonical E.164 (`+919876543210`). */
export function canonicalE164Phone(
  value: string,
  fallbackCountry: Country = DEFAULT_COUNTRY,
): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const parsed = parsePhoneNumberFromString(
    trimmed.startsWith('+') ? trimmed : trimmed,
    trimmed.startsWith('+') ? undefined : (fallbackCountry.iso2 as CountryCode),
  )
  if (parsed?.isValid()) return parsed.number

  if (trimmed.startsWith('+')) {
    const legacy = parseE164Phone(trimmed)
    return legacy ? toE164Phone(legacy.country, legacy.nationalNumber) : trimmed
  }

  return normalizePhoneNumber(trimmed, fallbackCountry)
}

export function parseE164Phone(e164: string): { country: Country; nationalNumber: string } | null {
  const normalized = e164.trim().startsWith('+') ? e164.trim() : `+${nationalDigits(e164)}`
  const parsed = parsePhoneNumberFromString(normalized)
  if (parsed?.country) {
    const country =
      findCountryByIso2(parsed.country) ??
      SORTED_BY_DIAL.find((c) => c.iso2 === parsed.country) ??
      null
    if (country) {
      return { country, nationalNumber: parsed.nationalNumber }
    }
  }

  const match = SORTED_BY_DIAL.find((country) => normalized.startsWith(country.dialCode))
  if (!match) return null
  return { country: match, nationalNumber: normalized.slice(match.dialCode.length) }
}

export function isValidPhone(value: string, country: Country = DEFAULT_COUNTRY) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('+')) return isValidPhoneNumber(trimmed)
  return isValidPhoneNumber(trimmed, country.iso2 as CountryCode)
}

/** Compare two phone strings after normalizing to E.164. */
export function phonesEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = canonicalE164Phone((a ?? '').trim())
  const right = canonicalE164Phone((b ?? '').trim())
  return Boolean(left && right && left === right)
}

export function formatPhoneForDisplay(value: string, country?: Country) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const canonical = trimmed.startsWith('+')
    ? trimmed
    : canonicalE164Phone(trimmed, country ?? DEFAULT_COUNTRY)
  const parsedLib = parsePhoneNumberFromString(canonical)
  if (parsedLib?.isValid()) {
    const iso = parsedLib.country
    const flag = iso ? countryFlag(iso) : ''
    return `${flag} ${parsedLib.formatInternational()}`.trim()
  }

  const parsed = parseE164Phone(canonical)
  if (parsed) {
    return `${countryFlag(parsed.country.iso2)} ${parsed.country.dialCode} ${parsed.nationalNumber}`
  }

  const active = country ?? DEFAULT_COUNTRY
  const digits = nationalDigits(trimmed)
  return `${countryFlag(active.iso2)} ${active.dialCode} ${digits}`
}
