import { getAllGeoCountries, getCountryByCode } from '~/lib/geo'

import type { Country } from '~/lib/phone/types'

type PhoneRule = Pick<Country, 'minLength' | 'maxLength' | 'pattern' | 'placeholder'>

const PHONE_RULES: Record<string, PhoneRule> = {
  IN: { minLength: 10, maxLength: 10, pattern: /^[6-9]\d{9}$/, placeholder: '98765 43210' },
  US: { minLength: 10, maxLength: 10, pattern: /^\d{10}$/, placeholder: '202 555 0100' },
  GB: { minLength: 10, maxLength: 10, pattern: /^7\d{9}$/, placeholder: '7911 123456' },
  AE: { minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
  AU: { minLength: 9, maxLength: 9, pattern: /^4\d{8}$/, placeholder: '412345678' },
  CA: { minLength: 10, maxLength: 10, pattern: /^\d{10}$/, placeholder: '416 555 0100' },
  SG: { minLength: 8, maxLength: 8, pattern: /^[89]\d{7}$/, placeholder: '81234567' },
  DE: { minLength: 10, maxLength: 11, pattern: /^1\d{9,10}$/, placeholder: '15123456789' },
  FR: { minLength: 9, maxLength: 9, pattern: /^[67]\d{8}$/, placeholder: '612345678' },
  IT: { minLength: 9, maxLength: 10, pattern: /^3\d{8,9}$/, placeholder: '3123456789' },
  ES: { minLength: 9, maxLength: 9, pattern: /^[67]\d{8}$/, placeholder: '612345678' },
  NL: { minLength: 9, maxLength: 9, pattern: /^6\d{8}$/, placeholder: '612345678' },
  CH: { minLength: 9, maxLength: 9, pattern: /^7[5-9]\d{7}$/, placeholder: '791234567' },
  SE: { minLength: 9, maxLength: 10, pattern: /^7\d{8,9}$/, placeholder: '701234567' },
  NO: { minLength: 8, maxLength: 8, pattern: /^[49]\d{7}$/, placeholder: '41234567' },
  DK: { minLength: 8, maxLength: 8, pattern: /^\d{8}$/, placeholder: '20123456' },
  FI: { minLength: 9, maxLength: 10, pattern: /^4\d{8,9}$/, placeholder: '412345678' },
  IE: { minLength: 9, maxLength: 9, pattern: /^8[3-9]\d{7}$/, placeholder: '851234567' },
  PT: { minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  PL: { minLength: 9, maxLength: 9, pattern: /^\d{9}$/, placeholder: '512345678' },
  RU: { minLength: 10, maxLength: 10, pattern: /^9\d{9}$/, placeholder: '9123456789' },
  TR: { minLength: 10, maxLength: 10, pattern: /^5\d{9}$/, placeholder: '5321234567' },
  SA: { minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
  QA: { minLength: 8, maxLength: 8, pattern: /^[3567]\d{7}$/, placeholder: '33123456' },
  KW: { minLength: 8, maxLength: 8, pattern: /^[569]\d{7}$/, placeholder: '50123456' },
  BH: { minLength: 8, maxLength: 8, pattern: /^3\d{7}$/, placeholder: '36123456' },
  OM: { minLength: 8, maxLength: 8, pattern: /^[79]\d{7}$/, placeholder: '92123456' },
  PK: { minLength: 10, maxLength: 10, pattern: /^3\d{9}$/, placeholder: '3012345678' },
  BD: { minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1712345678' },
  LK: { minLength: 9, maxLength: 9, pattern: /^7\d{8}$/, placeholder: '712345678' },
  NP: { minLength: 10, maxLength: 10, pattern: /^9[78]\d{8}$/, placeholder: '9841234567' },
  MY: { minLength: 9, maxLength: 10, pattern: /^1\d{8,9}$/, placeholder: '123456789' },
  TH: { minLength: 9, maxLength: 9, pattern: /^[689]\d{8}$/, placeholder: '812345678' },
  ID: { minLength: 9, maxLength: 11, pattern: /^8\d{8,10}$/, placeholder: '8123456789' },
  PH: { minLength: 10, maxLength: 10, pattern: /^9\d{9}$/, placeholder: '9123456789' },
  VN: { minLength: 9, maxLength: 9, pattern: /^[39]\d{8}$/, placeholder: '912345678' },
  JP: { minLength: 10, maxLength: 10, pattern: /^[789]0\d{8}$/, placeholder: '9012345678' },
  KR: { minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1012345678' },
  CN: { minLength: 11, maxLength: 11, pattern: /^1\d{10}$/, placeholder: '13123456789' },
  HK: { minLength: 8, maxLength: 8, pattern: /^[569]\d{7}$/, placeholder: '51234567' },
  TW: { minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  NZ: { minLength: 8, maxLength: 10, pattern: /^2\d{7,9}$/, placeholder: '211234567' },
  ZA: { minLength: 9, maxLength: 9, pattern: /^[6-8]\d{8}$/, placeholder: '711234567' },
  NG: { minLength: 10, maxLength: 10, pattern: /^[789]\d{9}$/, placeholder: '8012345678' },
  KE: { minLength: 9, maxLength: 9, pattern: /^7\d{8}$/, placeholder: '712345678' },
  EG: { minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1012345678' },
  BR: { minLength: 10, maxLength: 11, pattern: /^[1-9]\d{9,10}$/, placeholder: '11912345678' },
  MX: { minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '5512345678' },
  AR: { minLength: 10, maxLength: 10, pattern: /^9?\d{9,10}$/, placeholder: '91123456789' },
  CO: { minLength: 10, maxLength: 10, pattern: /^3\d{9}$/, placeholder: '3012345678' },
  CL: { minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  IL: { minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
}

const GENERIC_PHONE_RULE: PhoneRule = {
  minLength: 6,
  maxLength: 15,
  pattern: /^\d{6,15}$/,
  placeholder: 'Phone number',
}

function normalizeDialCode(phonecode: string): string {
  const digits = phonecode.replace(/\D/g, '')
  return digits ? `+${digits}` : '+'
}

function buildPhoneCountry(isoCode: string, name: string, phonecode: string): Country {
  const rule = PHONE_RULES[isoCode] ?? GENERIC_PHONE_RULE
  return {
    iso2: isoCode,
    name,
    dialCode: normalizeDialCode(phonecode),
    ...rule,
  }
}

let phoneCountriesCache: Country[] | null = null

export function getAllPhoneCountries(): Country[] {
  if (!phoneCountriesCache) {
    phoneCountriesCache = getAllGeoCountries()
      .filter((country) => country.phonecode?.trim())
      .map((country) => buildPhoneCountry(country.isoCode, country.name, country.phonecode))
  }
  return phoneCountriesCache
}

/** Always India (+91) for empty phone fields — product default across SHEconomy. */
export function getDefaultPhoneCountry(): Country {
  return findPhoneCountryByIso2('IN')
}

export function findPhoneCountryByIso2(iso2: string): Country {
  const code = iso2.toUpperCase()
  const fromCatalog = getAllPhoneCountries().find((country) => country.iso2 === code)
  if (fromCatalog) return fromCatalog

  const geo = getCountryByCode(code)
  if (geo?.phonecode) {
    return buildPhoneCountry(geo.isoCode, geo.name, geo.phonecode)
  }

  return getAllPhoneCountries().find((country) => country.iso2 === 'IN') ?? getAllPhoneCountries()[0]
}

export function findPhoneCountryByDialCode(dialCode: string): Country {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`
  const sorted = [...getAllPhoneCountries()].sort((a, b) => b.dialCode.length - a.dialCode.length)
  return (
    sorted.find((country) => country.dialCode === normalized) ??
    sorted.find((country) => normalized.startsWith(country.dialCode)) ??
    getDefaultPhoneCountry()
  )
}

export function filterPhoneCountries(query: string): Country[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return getAllPhoneCountries()

  return getAllPhoneCountries().filter((country) => {
    return (
      country.name.toLowerCase().includes(trimmed) ||
      country.iso2.toLowerCase().includes(trimmed) ||
      country.dialCode.includes(trimmed.replace(/\s/g, ''))
    )
  })
}

export function hasStrictPhoneRule(iso2: string): boolean {
  return iso2.toUpperCase() in PHONE_RULES
}
