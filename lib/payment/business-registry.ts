/**
 * Marketplace-style business registry helpers.
 * GSTIN / CIN / PAN detection + GST registry address auto-fill.
 * Live GST lookup goes through `shepay-verify-kyc` (Masters India when configured).
 */

import {
  getDefaultKycIdentifier,
  registrationLabelForCountry,
} from '~/lib/payment/country-kyc'
import {
  interpretGstRegistry,
  normalizePan,
  panFromGstin,
  verifyGstin,
  type GstRegistryResult,
} from '~/lib/payment/payu-kyc'

/** Indian CIN / LLPIN (21 chars). */
const CIN_RE = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/
const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export type RegistrationKind = 'gstin' | 'cin' | 'llpin' | 'pan' | 'unknown'

export type RegistryAddress = {
  line1: string
  city: string
  state: string
  postalCode: string
  countryCode: string
}

export type BusinessAutofill = {
  kind: RegistrationKind
  registrationNumber: string
  pan: string | null
  legalName: string
  tradeName: string
  status: string
  constitution: string
  address: RegistryAddress | null
  source: 'registry' | 'checksum' | 'format'
  verified: boolean
}

export function detectRegistrationKind(raw: string): RegistrationKind {
  const value = normalizePan(raw).replace(/-/g, '')
  const withDash = normalizePan(raw)
  if (value.length === 15 && verifyGstin(value).ok) return 'gstin'
  if (value.length === 21 && CIN_RE.test(value)) return 'cin'
  if (LLPIN_RE.test(withDash) || /^[A-Z]{3}[0-9]{4}$/.test(value)) return 'llpin'
  if (value.length === 10 && PAN_RE.test(value)) return 'pan'
  return 'unknown'
}

export function verifyCin(cin: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizePan(cin)
  if (!CIN_RE.test(value)) {
    return { ok: false, error: 'Enter a valid 21-character CIN (e.g. U12345MH2020PTC123456).' }
  }
  return { ok: true, value }
}

export function registrationPlaceholder(
  entity: 'BUSINESS' | 'INDIVIDUAL',
  countryCode = 'IN',
): string {
  return getDefaultKycIdentifier(countryCode, entity).placeholder
}

export function registrationLabel(
  entity: 'BUSINESS' | 'INDIVIDUAL',
  countryCode = 'IN',
): string {
  return registrationLabelForCountry(countryCode, entity)
}

/** Pull registered office from Masters India / GST search payload when present. */
export function parseGstRegistryAddress(data: unknown): RegistryAddress | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const pradr =
    root.pradr && typeof root.pradr === 'object' ? (root.pradr as Record<string, unknown>) : null
  const addrRaw =
    (pradr?.addr && typeof pradr.addr === 'object' ? pradr.addr : null) ||
    (root.addr && typeof root.addr === 'object' ? root.addr : null) ||
    null
  const addr = addrRaw as Record<string, unknown> | null
  if (!addr) {
    const flat = typeof pradr?.adr === 'string' ? pradr.adr.trim() : ''
    if (!flat) return null
    return {
      line1: flat,
      city: '',
      state: '',
      postalCode: '',
      countryCode: 'IN',
    }
  }

  const parts = [
    addr.bno,
    addr.flno,
    addr.bnm,
    addr.st,
    addr.landMark,
    addr.loc,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)

  const city = typeof addr.dst === 'string' && addr.dst.trim()
    ? addr.dst.trim()
    : typeof addr.loc === 'string'
      ? addr.loc.trim()
      : ''
  const state = typeof addr.stcd === 'string' ? addr.stcd.trim() : ''
  const postalCode = typeof addr.pncd === 'string' ? addr.pncd.trim() : ''

  if (!parts.length && !city && !postalCode) return null

  return {
    line1: parts.join(', '),
    city,
    state,
    postalCode,
    countryCode: 'IN',
  }
}

export function buildAutofillFromGst(
  interpreted: GstRegistryResult,
  rawData: unknown,
  source: 'registry' | 'checksum',
): BusinessAutofill {
  return {
    kind: 'gstin',
    registrationNumber: interpreted.gstin,
    pan: interpreted.pan,
    legalName: interpreted.legalName,
    tradeName: interpreted.tradeName || interpreted.legalName,
    status: interpreted.status,
    constitution: interpreted.constitution,
    address: parseGstRegistryAddress(rawData),
    source,
    verified: source === 'registry' || Boolean(interpreted.pan),
  }
}

/** Local-only autofill when registry credentials are not configured. */
export function buildChecksumGstAutofill(gstin: string): BusinessAutofill | null {
  const checked = verifyGstin(gstin)
  if (!checked.ok) return null
  return {
    kind: 'gstin',
    registrationNumber: normalizePan(gstin),
    pan: checked.pan || panFromGstin(gstin),
    legalName: '',
    tradeName: '',
    status: 'checksum',
    constitution: '',
    address: null,
    source: 'checksum',
    verified: true,
  }
}

export function interpretBusinessLookup(payload: {
  ok?: boolean
  configured?: boolean
  source?: string
  error?: string
  data?: unknown
  pan?: string
  gstin?: string | null
}): { ok: true; autofill: BusinessAutofill } | { ok: false; error: string } {
  if (payload.ok === false) {
    return { ok: false, error: payload.error || 'Could not verify this registration number.' }
  }

  if (payload.configured === false || payload.source === 'checksum') {
    const gstin = typeof payload.gstin === 'string' ? payload.gstin : ''
    const local = gstin ? buildChecksumGstAutofill(gstin) : null
    if (!local) {
      return {
        ok: true,
        autofill: {
          kind: detectRegistrationKind(payload.pan || ''),
          registrationNumber: normalizePan(payload.pan || payload.gstin || ''),
          pan: payload.pan || null,
          legalName: '',
          tradeName: '',
          status: 'checksum',
          constitution: '',
          address: null,
          source: 'checksum',
          verified: Boolean(payload.pan || payload.gstin),
        },
      }
    }
    return { ok: true, autofill: local }
  }

  const parsed = interpretGstRegistry({ data: payload.data })
  if (!parsed.ok) return { ok: false, error: parsed.error }
  return {
    ok: true,
    autofill: buildAutofillFromGst(parsed.result, payload.data, 'registry'),
  }
}

export { verifyGstin, normalizePan, panFromGstin }
