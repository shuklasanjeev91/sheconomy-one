/**
 * Global country-based KYC / KYB profile for vendor payout onboarding.
 * Drives registration ID labels, placeholders, validation, and autofill capability.
 */

import { resolveCountryCode } from '~/lib/geo'

export type KycEntityType = 'BUSINESS' | 'INDIVIDUAL'

/** Vendor business_identifiers.type (or local equivalent for individuals). */
export type KycIdentifierType =
  | 'GSTIN'
  | 'CIN'
  | 'PAN'
  | 'EIN'
  | 'ABN'
  | 'ACN'
  | 'UEN'
  | 'BRN'
  | 'CRN'
  | 'VAT'
  | 'UTR'
  | 'BN'
  | 'TRADE_LICENSE'
  | 'NATIONAL_ID'
  | 'OTHER'

export type CountryKycIdentifier = {
  type: KycIdentifierType
  /** Short chip / option label */
  label: string
  placeholder: string
  /** Hint under the field */
  hint: string
  /** Approximate expected length (for UX); 0 = variable */
  minLength: number
  maxLength: number
  /** Local format check before registry / submit */
  validate: (value: string) => { ok: true; value: string } | { ok: false; error: string }
  /** Live registry autofill available in Sheconomy today */
  autofill: boolean
}

export type CountryKycProfile = {
  countryCode: string
  countryName: string
  business: CountryKycIdentifier[]
  individual: CountryKycIdentifier[]
  /** Shown above registration field */
  businessSectionTitle: string
  individualSectionTitle: string
}

function upperAlnum(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function patternValidator(
  re: RegExp,
  error: string,
  normalize: (v: string) => string = upperAlnum,
): CountryKycIdentifier['validate'] {
  return (value) => {
    const next = normalize(value)
    if (!re.test(next)) return { ok: false, error }
    return { ok: true, value: next }
  }
}

/** Local GSTIN check (checksum) — live registry stays in business-registry. */
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function gstinChecksum(gstin14: string): string {
  let factor = 2
  let sum = 0
  for (let i = gstin14.length - 1; i >= 0; i--) {
    const code = GSTIN_CHARS.indexOf(gstin14[i] ?? '')
    if (code < 0) return ''
    let digit = factor * code
    factor = factor === 2 ? 1 : 2
    digit = Math.floor(digit / 36) + (digit % 36)
    sum += digit
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] ?? ''
}

function validateGstinLocal(value: string): { ok: true; value: string } | { ok: false; error: string } {
  const next = upperAlnum(value)
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(next)) {
    return { ok: false, error: 'Enter a valid GSTIN.' }
  }
  if (gstinChecksum(next.slice(0, 14)) !== next[14]) {
    return { ok: false, error: 'This GSTIN check digit does not match.' }
  }
  return { ok: true, value: next }
}

function validateCinLocal(value: string): { ok: true; value: string } | { ok: false; error: string } {
  const next = upperAlnum(value)
  if (!/^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(next)) {
    return { ok: false, error: 'Enter a valid 21-character CIN (e.g. U12345MH2020PTC123456).' }
  }
  return { ok: true, value: next }
}

const GENERIC_BRN: CountryKycIdentifier = {
  type: 'BRN',
  label: 'Business registration no.',
  placeholder: 'Official registration / tax ID',
  hint: 'Enter the government business registration or tax ID for this country.',
  minLength: 4,
  maxLength: 32,
  autofill: false,
  validate: (value) => {
    const next = value.trim()
    if (next.length < 4) return { ok: false, error: 'Enter a valid business registration number.' }
    return { ok: true, value: next }
  },
}

const GENERIC_NATIONAL_ID: CountryKycIdentifier = {
  type: 'NATIONAL_ID',
  label: 'National ID / tax ID',
  placeholder: 'Government ID or tax number',
  hint: 'Enter your personal tax or national ID as issued in this country.',
  minLength: 4,
  maxLength: 32,
  autofill: false,
  validate: (value) => {
    const next = value.trim()
    if (next.length < 4) return { ok: false, error: 'Enter a valid ID / tax number.' }
    return { ok: true, value: next }
  },
}

const IN_GSTIN: CountryKycIdentifier = {
  type: 'GSTIN',
  label: 'GSTIN',
  placeholder: '22AAAAA0000A1Z5',
  hint: 'We verify on the tax registry and auto-fill legal name, trade name, PAN, and address.',
  minLength: 15,
  maxLength: 15,
  autofill: true,
  validate: validateGstinLocal,
}

const IN_CIN: CountryKycIdentifier = {
  type: 'CIN',
  label: 'CIN',
  placeholder: 'U12345MH2020PTC123456',
  hint:
    '21-character CIN from MCA. Format only — legal name and address are not looked up from CIN. Use GSTIN to auto-fill those fields.',
  minLength: 21,
  maxLength: 21,
  autofill: false,
  validate: validateCinLocal,
}

const IN_PAN: CountryKycIdentifier = {
  type: 'PAN',
  label: 'PAN',
  placeholder: 'ABCDE1234F',
  hint: '10-character Permanent Account Number.',
  minLength: 10,
  maxLength: 10,
  autofill: false,
  validate: patternValidator(
    /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    'Enter a valid 10-character PAN (e.g. ABCDE1234F).',
  ),
}

/** Explicit profiles for primary marketplace countries; others fall back to BRN. */
const PROFILES: Record<string, CountryKycProfile> = {
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    businessSectionTitle: 'Company registration (India)',
    individualSectionTitle: 'Tax ID (India)',
    business: [IN_GSTIN, IN_CIN, IN_PAN],
    individual: [IN_PAN],
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    businessSectionTitle: 'Business tax ID (US)',
    individualSectionTitle: 'Tax ID (US)',
    business: [
      {
        type: 'EIN',
        label: 'EIN',
        placeholder: '12-3456789',
        hint: 'Employer Identification Number from the IRS.',
        minLength: 9,
        maxLength: 10,
        autofill: false,
        validate: (value) => {
          const digits = value.replace(/\D/g, '')
          if (digits.length !== 9) {
            return { ok: false, error: 'Enter a valid 9-digit EIN (e.g. 12-3456789).' }
          }
          return { ok: true, value: `${digits.slice(0, 2)}-${digits.slice(2)}` }
        },
      },
    ],
    individual: [
      {
        type: 'NATIONAL_ID',
        label: 'SSN (last 4) / ITIN',
        placeholder: 'XXX-XX-1234 or 9XX-XX-XXXX',
        hint: 'For individuals, provide ITIN or confirm identity during payout verification.',
        minLength: 4,
        maxLength: 11,
        autofill: false,
        validate: (value) => {
          const next = value.trim()
          if (next.replace(/\D/g, '').length < 4) {
            return { ok: false, error: 'Enter a valid tax ID.' }
          }
          return { ok: true, value: next }
        },
      },
    ],
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    businessSectionTitle: 'Company registration (UK)',
    individualSectionTitle: 'Tax ID (UK)',
    business: [
      {
        type: 'CRN',
        label: 'Company number',
        placeholder: '12345678',
        hint: 'Companies House registration number.',
        minLength: 6,
        maxLength: 8,
        autofill: false,
        validate: patternValidator(
          /^[A-Z0-9]{6,8}$/,
          'Enter a valid Companies House number (6–8 characters).',
        ),
      },
      {
        type: 'VAT',
        label: 'VAT number',
        placeholder: 'GB123456789',
        hint: 'Optional if you have a UK VAT registration.',
        minLength: 9,
        maxLength: 14,
        autofill: false,
        validate: (value) => {
          const next = upperAlnum(value).replace(/^GB/, '')
          if (!/^[0-9]{9}([0-9]{3})?$/.test(next)) {
            return { ok: false, error: 'Enter a valid UK VAT number.' }
          }
          return { ok: true, value: `GB${next}` }
        },
      },
      {
        type: 'UTR',
        label: 'UTR',
        placeholder: '1234567890',
        hint: 'Unique Taxpayer Reference for sole traders / partnerships.',
        minLength: 10,
        maxLength: 10,
        autofill: false,
        validate: patternValidator(/^[0-9]{10}$/, 'Enter a valid 10-digit UTR.'),
      },
    ],
    individual: [
      {
        type: 'UTR',
        label: 'UTR',
        placeholder: '1234567890',
        hint: 'Unique Taxpayer Reference.',
        minLength: 10,
        maxLength: 10,
        autofill: false,
        validate: patternValidator(/^[0-9]{10}$/, 'Enter a valid 10-digit UTR.'),
      },
      GENERIC_NATIONAL_ID,
    ],
  },
  AU: {
    countryCode: 'AU',
    countryName: 'Australia',
    businessSectionTitle: 'Business registration (Australia)',
    individualSectionTitle: 'Tax ID (Australia)',
    business: [
      {
        type: 'ABN',
        label: 'ABN',
        placeholder: '12 345 678 901',
        hint: '11-digit Australian Business Number.',
        minLength: 11,
        maxLength: 14,
        autofill: false,
        validate: (value) => {
          const digits = value.replace(/\D/g, '')
          if (digits.length !== 11) {
            return { ok: false, error: 'Enter a valid 11-digit ABN.' }
          }
          return { ok: true, value: digits }
        },
      },
      {
        type: 'ACN',
        label: 'ACN',
        placeholder: '123 456 789',
        hint: '9-digit Australian Company Number (companies).',
        minLength: 9,
        maxLength: 11,
        autofill: false,
        validate: (value) => {
          const digits = value.replace(/\D/g, '')
          if (digits.length !== 9) {
            return { ok: false, error: 'Enter a valid 9-digit ACN.' }
          }
          return { ok: true, value: digits }
        },
      },
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    businessSectionTitle: 'Business registration (Singapore)',
    individualSectionTitle: 'NRIC / FIN',
    business: [
      {
        type: 'UEN',
        label: 'UEN',
        placeholder: '201912345A',
        hint: 'Unique Entity Number from ACRA.',
        minLength: 9,
        maxLength: 10,
        autofill: false,
        validate: patternValidator(
          /^[0-9]{8,9}[A-Z]$|^[STFG][0-9]{7}[A-Z]$/i,
          'Enter a valid Singapore UEN.',
          (v) => upperAlnum(v),
        ),
      },
    ],
    individual: [
      {
        type: 'NATIONAL_ID',
        label: 'NRIC / FIN',
        placeholder: 'S1234567A',
        hint: 'Singapore NRIC or FIN.',
        minLength: 9,
        maxLength: 9,
        autofill: false,
        validate: patternValidator(
          /^[STFGM]\d{7}[A-Z]$/,
          'Enter a valid NRIC / FIN.',
        ),
      },
    ],
  },
  HK: {
    countryCode: 'HK',
    countryName: 'Hong Kong',
    businessSectionTitle: 'Business registration (Hong Kong)',
    individualSectionTitle: 'HKID',
    business: [
      {
        type: 'BRN',
        label: 'BRN',
        placeholder: '12345678-000',
        hint: 'Business Registration Number.',
        minLength: 8,
        maxLength: 16,
        autofill: false,
        validate: (value) => {
          const next = value.trim().toUpperCase()
          if (next.replace(/[^0-9A-Z]/g, '').length < 8) {
            return { ok: false, error: 'Enter a valid Hong Kong BRN.' }
          }
          return { ok: true, value: next }
        },
      },
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
  AE: {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    businessSectionTitle: 'Trade license (UAE)',
    individualSectionTitle: 'Emirates ID',
    business: [
      {
        type: 'TRADE_LICENSE',
        label: 'Trade license no.',
        placeholder: 'License number',
        hint: 'Trade license number from the issuing free zone / DED.',
        minLength: 5,
        maxLength: 32,
        autofill: false,
        validate: (value) => {
          const next = value.trim()
          if (next.length < 5) return { ok: false, error: 'Enter a valid trade license number.' }
          return { ok: true, value: next }
        },
      },
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    businessSectionTitle: 'Business number (Canada)',
    individualSectionTitle: 'SIN / tax ID',
    business: [
      {
        type: 'BN',
        label: 'BN',
        placeholder: '123456789',
        hint: '9-digit CRA Business Number (first 9 digits).',
        minLength: 9,
        maxLength: 15,
        autofill: false,
        validate: (value) => {
          const digits = value.replace(/\D/g, '')
          if (digits.length < 9) return { ok: false, error: 'Enter a valid 9-digit Business Number.' }
          return { ok: true, value: digits.slice(0, 9) }
        },
      },
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Germany',
    businessSectionTitle: 'Business registration (Germany)',
    individualSectionTitle: 'Tax ID (Germany)',
    business: [
      {
        type: 'VAT',
        label: 'VAT / USt-IdNr',
        placeholder: 'DE123456789',
        hint: 'German VAT identification number.',
        minLength: 11,
        maxLength: 14,
        autofill: false,
        validate: patternValidator(
          /^DE[0-9]{9}$/,
          'Enter a valid German VAT ID (DE + 9 digits).',
        ),
      },
      GENERIC_BRN,
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
  FR: {
    countryCode: 'FR',
    countryName: 'France',
    businessSectionTitle: 'Business registration (France)',
    individualSectionTitle: 'Tax ID (France)',
    business: [
      {
        type: 'BRN',
        label: 'SIRET / SIREN',
        placeholder: '12345678900012',
        hint: '9-digit SIREN or 14-digit SIRET.',
        minLength: 9,
        maxLength: 14,
        autofill: false,
        validate: (value) => {
          const digits = value.replace(/\D/g, '')
          if (digits.length !== 9 && digits.length !== 14) {
            return { ok: false, error: 'Enter a valid SIREN (9) or SIRET (14).' }
          }
          return { ok: true, value: digits }
        },
      },
      {
        type: 'VAT',
        label: 'VAT',
        placeholder: 'FR12345678901',
        hint: 'French VAT number if registered.',
        minLength: 13,
        maxLength: 13,
        autofill: false,
        validate: patternValidator(
          /^FR[A-Z0-9]{2}[0-9]{9}$/,
          'Enter a valid French VAT number.',
        ),
      },
    ],
    individual: [GENERIC_NATIONAL_ID],
  },
}

function fallbackProfile(countryCode: string): CountryKycProfile {
  const code = resolveCountryCode(countryCode) || 'XX'
  return {
    countryCode: code,
    countryName: code,
    businessSectionTitle: 'Business registration',
    individualSectionTitle: 'Personal tax / national ID',
    business: [{ ...GENERIC_BRN }],
    individual: [{ ...GENERIC_NATIONAL_ID }],
  }
}

export function getCountryKycProfile(countryCode: string): CountryKycProfile {
  const code = resolveCountryCode(countryCode)
  return PROFILES[code] ?? fallbackProfile(code)
}

export function listCountryKycIdentifiers(
  countryCode: string,
  entity: KycEntityType,
): CountryKycIdentifier[] {
  const profile = getCountryKycProfile(countryCode)
  return entity === 'BUSINESS' ? profile.business : profile.individual
}

export function getDefaultKycIdentifier(
  countryCode: string,
  entity: KycEntityType,
): CountryKycIdentifier {
  return listCountryKycIdentifiers(countryCode, entity)[0] ?? GENERIC_BRN
}

export function getKycIdentifier(
  countryCode: string,
  entity: KycEntityType,
  type: KycIdentifierType,
): CountryKycIdentifier | null {
  return listCountryKycIdentifiers(countryCode, entity).find((item) => item.type === type) ?? null
}

export function registrationLabelForCountry(
  countryCode: string,
  entity: KycEntityType,
  type?: KycIdentifierType,
): string {
  const profile = getCountryKycProfile(countryCode)
  const id = type
    ? getKycIdentifier(countryCode, entity, type)
    : getDefaultKycIdentifier(countryCode, entity)
  if (entity === 'BUSINESS') {
    return id?.label ? `${profile.businessSectionTitle} · ${id.label}` : profile.businessSectionTitle
  }
  return id?.label ? `${profile.individualSectionTitle} · ${id.label}` : profile.individualSectionTitle
}

export function validateCountryRegistration(input: {
  countryCode: string
  entity: KycEntityType
  type: KycIdentifierType
  value: string
}): { ok: true; value: string; identifier: CountryKycIdentifier } | { ok: false; error: string } {
  const identifier =
    getKycIdentifier(input.countryCode, input.entity, input.type) ??
    getDefaultKycIdentifier(input.countryCode, input.entity)
  if (!input.value.trim()) {
    return { ok: false, error: `Enter your ${identifier.label}.` }
  }
  const result = identifier.validate(input.value)
  if (!result.ok) return result
  return { ok: true, value: result.value, identifier }
}

export function countrySupportsRegistryAutofill(
  countryCode: string,
  type: KycIdentifierType,
): boolean {
  const ids = [
    ...listCountryKycIdentifiers(countryCode, 'BUSINESS'),
    ...listCountryKycIdentifiers(countryCode, 'INDIVIDUAL'),
  ]
  return ids.some((item) => item.type === type && item.autofill)
}

/** Countries with an explicit KYC profile (for admin / docs). */
export function listConfiguredKycCountryCodes(): string[] {
  return Object.keys(PROFILES).sort()
}

/** Lowercase key used inside business_details / individual_details JSON. */
export function registrationStorageKey(type: KycIdentifierType): string {
  return type.toLowerCase()
}

const LEGACY_NUMBER_KEYS = [
  'gstin',
  'cin',
  'pan',
  'ein',
  'abn',
  'acn',
  'uen',
  'brn',
  'crn',
  'vat',
  'utr',
  'bn',
  'trade_license',
  'national_id',
  'identifier_number',
  'registration_number',
] as const

export function readStoredRegistration(details: Record<string, unknown> | null | undefined): {
  type: KycIdentifierType | null
  value: string
} {
  if (!details) return { type: null, value: '' }
  const typed = typeof details.identifier_type === 'string'
    ? (details.identifier_type.toUpperCase() as KycIdentifierType)
    : null
  if (typed) {
    const key = registrationStorageKey(typed)
    const fromTyped =
      (typeof details[key] === 'string' && details[key]) ||
      (typeof details.identifier_number === 'string' && details.identifier_number) ||
      (typeof details.registration_number === 'string' && details.registration_number) ||
      ''
    return { type: typed, value: String(fromTyped).trim() }
  }
  for (const key of LEGACY_NUMBER_KEYS) {
    const raw = details[key]
    if (typeof raw === 'string' && raw.trim()) {
      const asType = key === 'trade_license'
        ? 'TRADE_LICENSE'
        : key === 'national_id'
          ? 'NATIONAL_ID'
          : key === 'identifier_number' || key === 'registration_number'
            ? null
            : (key.toUpperCase() as KycIdentifierType)
      return { type: asType, value: raw.trim() }
    }
  }
  return { type: null, value: '' }
}

/** Patch for business_details / individual_details when saving a country ID. */
export function buildRegistrationDetailsPatch(input: {
  type: KycIdentifierType
  value: string
  previous?: Record<string, unknown>
}): Record<string, unknown> {
  const key = registrationStorageKey(input.type)
  const next: Record<string, unknown> = {
    ...(input.previous ?? {}),
    identifier_type: input.type,
    identifier_number: input.value,
    [key]: input.value,
  }
  return next
}

/**
 * Shape suitable for vendor `account_details.business_details.business_identifiers`.
 * Individuals keep tax IDs in individual_details rather than this array.
 */
export function toVendorBusinessIdentifiers(input: {
  countryCode: string
  type: KycIdentifierType
  value: string
}): Array<{ type: string; number: string; country_code: string }> {
  const country = resolveCountryCode(input.countryCode)
  // Many payout rails expect BRN for many locales; pass our type when specific.
  const awxType =
    input.type === 'GSTIN' ||
    input.type === 'CIN' ||
    input.type === 'PAN' ||
    input.type === 'NATIONAL_ID' ||
    input.type === 'TRADE_LICENSE' ||
    input.type === 'OTHER'
      ? 'BRN'
      : input.type
  return [
    {
      type: awxType,
      number: input.value,
      country_code: country,
    },
  ]
}
