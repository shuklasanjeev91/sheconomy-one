/**
 * Country-aware payout bank field profiles for vendor KYC.
 */

import { resolveCountryCode } from '~/lib/geo'
import { normalizeIfsc } from '~/lib/payment/payu-kyc'

export type CountryBankProfile = {
  countryCode: string
  currency: string
  /** Primary account field label */
  accountLabel: string
  requireIfsc: boolean
  requireSwift: boolean
  requireRouting: boolean
  requireIban: boolean
  requireBankName: boolean
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

const PROFILES: Record<string, CountryBankProfile> = {
  IN: {
    countryCode: 'IN',
    currency: 'INR',
    accountLabel: 'Bank account number',
    requireIfsc: true,
    requireSwift: false,
    requireRouting: false,
    requireIban: false,
    requireBankName: false,
  },
  US: {
    countryCode: 'US',
    currency: 'USD',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: false,
    requireRouting: true,
    requireIban: false,
    requireBankName: true,
  },
  GB: {
    countryCode: 'GB',
    currency: 'GBP',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: true,
    requireIban: false,
    requireBankName: true,
  },
  AU: {
    countryCode: 'AU',
    currency: 'AUD',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: false,
    requireRouting: true,
    requireIban: false,
    requireBankName: true,
  },
  SG: {
    countryCode: 'SG',
    currency: 'SGD',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: false,
    requireBankName: true,
  },
  HK: {
    countryCode: 'HK',
    currency: 'HKD',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: false,
    requireBankName: true,
  },
  AE: {
    countryCode: 'AE',
    currency: 'AED',
    accountLabel: 'IBAN',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: true,
    requireBankName: true,
  },
  CA: {
    countryCode: 'CA',
    currency: 'CAD',
    accountLabel: 'Account number',
    requireIfsc: false,
    requireSwift: false,
    requireRouting: true,
    requireIban: false,
    requireBankName: true,
  },
  DE: {
    countryCode: 'DE',
    currency: 'EUR',
    accountLabel: 'IBAN',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: true,
    requireBankName: true,
  },
  FR: {
    countryCode: 'FR',
    currency: 'EUR',
    accountLabel: 'IBAN',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: true,
    requireBankName: true,
  },
}

function fallbackProfile(countryCode: string): CountryBankProfile {
  return {
    countryCode,
    currency: 'USD',
    accountLabel: 'Account number / IBAN',
    requireIfsc: false,
    requireSwift: true,
    requireRouting: false,
    requireIban: false,
    requireBankName: true,
  }
}

export function getCountryBankProfile(countryCode: string): CountryBankProfile {
  const code = resolveCountryCode(countryCode)
  return PROFILES[code] ?? fallbackProfile(code || 'XX')
}

export type VendorBankDetails = {
  holder_name: string
  account_number: string
  bank_name: string
  country_code: string
  currency: string
  ifsc?: string
  routing_code?: string
  iban?: string
  swift_bic?: string
}

export function parseBankDetails(raw: Record<string, unknown> | null | undefined): VendorBankDetails {
  const country = resolveCountryCode(String(raw?.country_code || 'IN')) || 'IN'
  const profile = getCountryBankProfile(country)
  return {
    holder_name: String(raw?.holder_name || ''),
    account_number: String(raw?.account_number || raw?.iban || ''),
    bank_name: String(raw?.bank_name || ''),
    country_code: country,
    currency: String(raw?.currency || profile.currency),
    ifsc: raw?.ifsc ? String(raw.ifsc) : '',
    routing_code: raw?.routing_code ? String(raw.routing_code) : '',
    iban: raw?.iban ? String(raw.iban) : '',
    swift_bic: raw?.swift_bic ? String(raw.swift_bic) : '',
  }
}

export function validateBankDetails(input: VendorBankDetails): string[] {
  const errors: string[] = []
  const profile = getCountryBankProfile(input.country_code)
  if (!input.holder_name.trim()) errors.push('Account holder name is required')
  const account = (profile.requireIban ? input.iban || input.account_number : input.account_number).trim()
  if (account.length < 4) errors.push(`Enter a valid ${profile.accountLabel.toLowerCase()}`)
  if (profile.requireBankName && !input.bank_name.trim()) {
    errors.push('Bank name is required')
  }
  if (profile.requireIfsc) {
    const ifsc = normalizeIfsc(input.ifsc || '')
    if (!IFSC_RE.test(ifsc)) errors.push('Enter a valid IFSC')
  }
  if (profile.requireSwift) {
    const swift = (input.swift_bic || '').trim().toUpperCase()
    if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) {
      errors.push('Enter a valid SWIFT / BIC')
    }
  }
  if (profile.requireRouting && !(input.routing_code || '').trim()) {
    errors.push(
      profile.countryCode === 'US'
        ? 'Routing number is required'
        : profile.countryCode === 'AU'
          ? 'BSB is required'
          : profile.countryCode === 'GB'
            ? 'Sort code is required'
            : 'Bank routing code is required',
    )
  }
  if (profile.requireIban) {
    const iban = (input.iban || input.account_number || '').replace(/\s+/g, '').toUpperCase()
    if (iban.length < 15) errors.push('Enter a valid IBAN')
  }
  return errors
}

export function normalizeBankDetails(input: VendorBankDetails): VendorBankDetails {
  const profile = getCountryBankProfile(input.country_code)
  const iban = (input.iban || '').replace(/\s+/g, '').toUpperCase()
  const account = (input.account_number || '').replace(/\s+/g, '')
  return {
    holder_name: input.holder_name.trim(),
    account_number: profile.requireIban ? iban || account : account,
    bank_name: input.bank_name.trim(),
    country_code: profile.countryCode,
    currency: input.currency || profile.currency,
    ifsc: input.ifsc ? normalizeIfsc(input.ifsc) : '',
    routing_code: (input.routing_code || '').replace(/\s+/g, ''),
    iban: iban,
    swift_bic: (input.swift_bic || '').trim().toUpperCase(),
  }
}
