/** In-app vendor payout KYC. PayU ids stay on the server; vendors never see them. */

export const PAYU_KYC_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'payu_pending',
  'payu_verified',
  'rejected',
] as const

export type PayuKycStatus = (typeof PAYU_KYC_STATUSES)[number]

/** Retail / e-commerce pair from PayU's category list. Not shown to vendors. */
export const PAYU_MARKETPLACE_CATEGORY = {
  business_category_id: 16,
  business_sub_category_id: 128,
} as const

export const PAYU_BUSINESS_ENTITIES = [
  { id: 2, label: 'Sole Proprietorship' },
  { id: 14, label: 'Individual' },
  { id: 3, label: 'Partnership' },
  { id: 4, label: 'Private Limited' },
  { id: 6, label: 'LLP' },
  { id: 16, label: 'One Person Company' },
  { id: 8, label: 'Society' },
  { id: 7, label: 'Trust' },
] as const

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^[0-9]{9,18}$/

/** Fourth character of a PAN, and the business types that use it. */
const PAN_ENTITY_TYPES: Record<string, readonly number[]> = {
  P: [2, 14],
  C: [4, 16],
  F: [3, 6],
  T: [7],
  A: [8],
}

export type PayuKycInput = {
  legalName: string
  mobile: string
  email: string
  panNumber: string
  panName: string
  hasGst: boolean
  gstNumber: string
  businessName: string
  businessEntityId: number
  monthlyExpectedVolume: number
  bankAccountNumber: string
  bankHolderName: string
  ifsc: string
  panDocumentPath: string
  bankDocumentPath: string
  gstDocumentPath: string
  scheduleCDocumentPath: string
}

export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizePan(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function normalizeIfsc(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function holderNameMatches(holder: string, panName: string, businessName: string): boolean {
  const name = normalizePersonName(holder)
  if (!name) return false
  return name === normalizePersonName(panName) || name === normalizePersonName(businessName)
}

/** PAN embedded in a GSTIN (characters 3–12). */
export function panFromGstin(gstin: string): string {
  return normalizePan(gstin).slice(2, 12)
}

export function gstinChecksum(gstin14: string): string {
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

export function verifyGstin(gstin: string): { ok: true; pan: string } | { ok: false; error: string } {
  const value = normalizePan(gstin)
  if (!GSTIN_RE.test(value)) return { ok: false, error: 'Enter a valid GSTIN.' }
  if (gstinChecksum(value.slice(0, 14)) !== value[14]) {
    return { ok: false, error: 'This GSTIN check digit does not match.' }
  }
  const pan = panFromGstin(value)
  if (!PAN_RE.test(pan)) return { ok: false, error: 'This GSTIN does not contain a valid PAN.' }
  return { ok: true, pan }
}

export function verifyPanForEntity(pan: string, businessEntityId: number): string | null {
  const value = normalizePan(pan)
  if (!PAN_RE.test(value)) return 'Enter a valid PAN.'
  const letter = value[3] ?? ''
  const allowed = PAN_ENTITY_TYPES[letter]
  if (!allowed) return 'This PAN type cannot be used for a shop payout account.'
  if (!allowed.includes(businessEntityId)) {
    return 'This PAN does not match the business type you selected.'
  }
  return null
}

export type GstRegistryResult = {
  gstin: string
  pan: string
  legalName: string
  tradeName: string
  status: string
  constitution: string
}

export function interpretGstRegistry(
  payload: unknown,
  expectedPan?: string,
): { ok: true; result: GstRegistryResult } | { ok: false; error: string } {
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null
  if (!data || typeof data.gstin !== 'string') {
    return { ok: false, error: 'GSTIN was not found on the tax registry.' }
  }
  const status = typeof data.sts === 'string' ? data.sts.trim() : ''
  if (status.toLowerCase() !== 'active') {
    return { ok: false, error: status ? `This GSTIN is ${status}.` : 'This GSTIN is not active.' }
  }
  const gstin = normalizePan(data.gstin)
  const checked = verifyGstin(gstin)
  if (!checked.ok) return checked
  if (expectedPan && normalizePan(expectedPan) !== checked.pan) {
    return { ok: false, error: 'PAN does not match the PAN on this GSTIN.' }
  }
  return {
    ok: true,
    result: {
      gstin,
      pan: checked.pan,
      legalName: typeof data.lgnm === 'string' ? data.lgnm.trim() : '',
      tradeName: typeof data.tradeNam === 'string' ? data.tradeNam.trim() : '',
      status,
      constitution: typeof data.ctb === 'string' ? data.ctb.trim() : '',
    },
  }
}

export function maskSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 4) return '••••'
  return `••••${trimmed.slice(-4)}`
}

/** Legacy shops with no KYC row stay on the existing verified flag. */
export function kycAllowsStorefront(status: PayuKycStatus | null | undefined): boolean {
  if (!status) return true
  return status === 'payu_verified'
}

export function validatePayuKycInput(input: PayuKycInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.legalName.trim()) errors.legalName = 'Enter the name on your PAN.'
  if (normalizeMobile(input.mobile).length !== 10) errors.mobile = 'Enter a 10-digit mobile number.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Enter a valid email.'
  if (!PAN_RE.test(normalizePan(input.panNumber))) errors.panNumber = 'Enter a valid PAN.'
  else {
    const panEntityError = verifyPanForEntity(input.panNumber, input.businessEntityId)
    if (panEntityError && panEntityError !== 'Enter a valid PAN.') errors.panNumber = panEntityError
  }
  if (!input.panName.trim()) errors.panName = 'Enter the name printed on the PAN.'
  if (!input.businessName.trim()) errors.businessName = 'Enter the business name.'
  if (!PAYU_BUSINESS_ENTITIES.some((row) => row.id === input.businessEntityId)) {
    errors.businessEntityId = 'Choose a business type.'
  }
  if (!Number.isFinite(input.monthlyExpectedVolume) || input.monthlyExpectedVolume < 1) {
    errors.monthlyExpectedVolume = 'Enter expected monthly sales in rupees.'
  }
  if (input.hasGst) {
    const gst = verifyGstin(input.gstNumber)
    if (!gst.ok) errors.gstNumber = gst.error
    else if (normalizePan(input.panNumber) !== gst.pan) {
      errors.panNumber = 'PAN must match the PAN on this GSTIN.'
    }
    if (!input.gstDocumentPath.trim()) errors.gstDocumentPath = 'Upload the GST certificate.'
  }
  if (!ACCOUNT_RE.test(input.bankAccountNumber.replace(/\s+/g, ''))) {
    errors.bankAccountNumber = 'Enter a 9–18 digit account number.'
  }
  if (!IFSC_RE.test(normalizeIfsc(input.ifsc))) errors.ifsc = 'Enter a valid IFSC.'
  if (!holderNameMatches(input.bankHolderName, input.panName, input.businessName)) {
    errors.bankHolderName = 'Account holder name must match the PAN name or business name.'
  }
  if (!input.panDocumentPath.trim()) errors.panDocumentPath = 'Upload the PAN card.'
  if (!input.bankDocumentPath.trim()) errors.bankDocumentPath = 'Upload a cancelled cheque or bank proof.'
  if (!input.scheduleCDocumentPath.trim()) {
    errors.scheduleCDocumentPath = 'Upload the signed Schedule C document.'
  }
  return errors
}

export type PayuCreateChildPayload = {
  product_account: {
    product: 'PayUbiz'
    name: string
    email: string
    mobile: string
    aggregator_parent_mid: string
    merchant_type: 'aggregator'
    merchant_defined_identifier: string
    business_entity_id: number
    pancard_number: string
    pancard_name: string
    business_name: string
    business_category_id: number
    business_sub_category_id: number
    monthly_expected_volume: number
    gst_number?: string
  }
}

export function buildCreateChildPayload(input: {
  shopId: string
  parentMid: string
  legalName: string
  email: string
  mobile: string
  panNumber: string
  panName: string
  businessName: string
  businessEntityId: number
  monthlyExpectedVolume: number
  gstNumber?: string | null
}): PayuCreateChildPayload {
  const gst = input.gstNumber ? normalizePan(input.gstNumber) : ''
  return {
    product_account: {
      product: 'PayUbiz',
      name: input.legalName.trim(),
      email: input.email.trim(),
      mobile: normalizeMobile(input.mobile),
      aggregator_parent_mid: input.parentMid,
      merchant_type: 'aggregator',
      merchant_defined_identifier: input.shopId,
      business_entity_id: input.businessEntityId,
      pancard_number: normalizePan(input.panNumber),
      pancard_name: input.panName.trim(),
      business_name: input.businessName.trim(),
      business_category_id: PAYU_MARKETPLACE_CATEGORY.business_category_id,
      business_sub_category_id: PAYU_MARKETPLACE_CATEGORY.business_sub_category_id,
      monthly_expected_volume: Math.round(input.monthlyExpectedVolume),
      ...(gst ? { gst_number: gst } : {}),
    },
  }
}

export function buildBankUpdatePayload(input: {
  bankAccountNumber: string
  bankHolderName: string
  ifsc: string
}) {
  return {
    product_account: {
      bank_detail: {
        bank_account_number: input.bankAccountNumber.replace(/\s+/g, ''),
        holder_name: input.bankHolderName.trim(),
        ifsc_code: normalizeIfsc(input.ifsc),
      },
    },
  }
}

export type ShopPayuKycRow = {
  shop_id: string
  legal_name: string
  mobile: string
  email: string
  pan_number: string
  pan_name: string
  gst_number: string | null
  business_name: string
  business_entity_id: number
  monthly_expected_volume: number
  bank_account_number: string
  bank_holder_name: string
  ifsc: string
  pan_document_path: string | null
  bank_document_path: string | null
  gst_document_path: string | null
  schedule_c_document_path: string | null
  gst_legal_name: string | null
  gst_trade_name: string | null
  gst_status: string | null
  status: PayuKycStatus
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  payu_product_account_uuid: string | null
  payu_mid: string | null
  payu_merchant_key: string | null
  payu_onboarding_status: string | null
  payu_document_status: string | null
  payu_kyc_status: string | null
  payu_error: string | null
  created_at: string
  updated_at: string
}

export type ShopKycDocumentRow = {
  id: string
  shop_id: string
  kind: 'pan' | 'bank' | 'schedule_c' | 'gst'
  storage_path: string
  mime_type: string | null
  file_size: number | null
  payu_document_uuid: string | null
  payu_document_status: string | null
  rejection_reason: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}
