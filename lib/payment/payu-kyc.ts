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

export const PAYU_KYC_DOC_KINDS = [
  'pan',
  'bank',
  'schedule_c',
  'gst',
  'incorporation',
  'ownership',
  'id_front',
  'id_back',
] as const

export type PayuKycDocKind = (typeof PAYU_KYC_DOC_KINDS)[number]

/** Docs forwarded to PayU on approve. Everything else is admin-only. */
export const PAYU_FORWARDED_DOC_KINDS = ['pan', 'bank', 'schedule_c', 'gst'] as const

/** PayU Create Child Merchant `business_entity_id` values used for sellers. */
export const PAYU_BUSINESS_ENTITIES = [
  { id: 14, label: 'Individual', shortLabel: 'Individual', group: 'person' },
  { id: 2, label: 'Sole Proprietorship', shortLabel: 'Sole Prop', group: 'person' },
  { id: 10, label: 'HUF', shortLabel: 'HUF', group: 'person' },
  { id: 3, label: 'Partnership', shortLabel: 'Partnership', group: 'firm' },
  { id: 6, label: 'LLP', shortLabel: 'LLP', group: 'firm' },
  { id: 4, label: 'Private Limited', shortLabel: 'Private Ltd', group: 'company' },
  { id: 5, label: 'Public Limited / Corporation', shortLabel: 'Public Ltd', group: 'company' },
  { id: 16, label: 'One Person Company', shortLabel: 'OPC', group: 'company' },
  { id: 1, label: 'Association of Persons', shortLabel: 'AOP', group: 'nonprofit' },
  { id: 8, label: 'Society', shortLabel: 'Society', group: 'nonprofit' },
  { id: 7, label: 'Trust', shortLabel: 'Trust', group: 'nonprofit' },
  { id: 15, label: 'NGO', shortLabel: 'NGO', group: 'nonprofit' },
] as const

export type PayuBusinessEntityId = (typeof PAYU_BUSINESS_ENTITIES)[number]['id']
export type EntityKycGroup = (typeof PAYU_BUSINESS_ENTITIES)[number]['group']

/**
 * Top-level legal-structure buckets shown first in Verification.
 * Pick a group, then a specific PayU entity within it.
 */
export const PAYU_BUSINESS_ENTITY_GROUPS: Array<{
  id: EntityKycGroup
  label: string
  hint: string
}> = [
  { id: 'person', label: 'Person', hint: 'Individual, sole proprietor, or HUF' },
  { id: 'firm', label: 'Firm', hint: 'Partnership or LLP' },
  { id: 'company', label: 'Company', hint: 'Private Ltd, public Ltd, or OPC' },
  { id: 'nonprofit', label: 'Nonprofit', hint: 'Trust, society, NGO, or AOP' },
]

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
const ACCOUNT_RE = /^[0-9]{9,18}$/
const CIN_RE = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/
const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/

export function normalizeLlpin(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '')
  if (/^[A-Z]{3}[0-9]{4}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`
  }
  return value.trim().toUpperCase()
}

export function verifyKycCin(
  cin: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizePan(cin)
  if (!CIN_RE.test(value)) {
    return { ok: false, error: 'Enter a valid 21-character CIN (e.g. U12345MH2020PTC123456).' }
  }
  return { ok: true, value }
}

export function verifyKycLlpin(
  llpin: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeLlpin(llpin)
  if (!LLPIN_RE.test(value)) {
    return { ok: false, error: 'Enter a valid LLPIN (e.g. AAA-1234).' }
  }
  return { ok: true, value }
}

/**
 * Fourth character of an Indian PAN → PayU entity ids that may use it.
 * NGO (15) accepts company / trust / AOP PAN letters.
 */
const PAN_ENTITY_TYPES: Record<string, readonly number[]> = {
  P: [2, 14],
  C: [4, 5, 16, 15],
  F: [3, 6],
  T: [7, 15],
  A: [1, 8, 15],
  H: [10],
}

export type EntityKycRequirements = {
  entityId: number
  group: EntityKycGroup
  summary: string
  legalNameLabel: string
  legalNameHint: string
  legalNamePlaceholder: string
  tradeNameLabel: string
  tradeNameHint: string
  tradeNamePlaceholder: string
  panNameHint: string
  bankHolderHint: string
  registrationSectionTitle: string
  registrationSectionHint: string
  cinLabel: string
  cinPlaceholder: string
  llpinLabel: string
  llpinPlaceholder: string
  registrationNumberLabel: string
  registrationNumberPlaceholder: string
  /** Extra registry IDs required for admin review. */
  requiresCin: boolean
  requiresLlpin: boolean
  requiresRegistrationNumber: boolean
  /** Keep legal name synced with PAN name while typing (person entities). */
  syncLegalWithPan: boolean
  /**
   * Soft nudge only — GST is never mandatory.
   * Companies/firms are prompted but can declare not registered.
   */
  suggestGst: boolean
  /** Admin-only docs required before submit. */
  requiredAdminDocs: Array<{
    kind: PayuKycDocKind
    label: string
  }>
  /** Optional admin docs shown for this entity. */
  optionalAdminDocs: Array<{
    kind: PayuKycDocKind
    label: string
  }>
}

/** GST declaration on seller KYC. */
export const PAYU_GST_ENROLLMENTS = [
  {
    id: 'registered',
    label: 'I have a GSTIN',
    hint: 'We verify it on the tax registry and autofill PAN, legal name, and business type.',
  },
  {
    id: 'not_registered',
    label: 'Not registered under GST',
    hint: 'Allowed when turnover is below the GST threshold, the category is exempt, or GSTIN is still pending.',
  },
] as const

export type PayuGstEnrollment = (typeof PAYU_GST_ENROLLMENTS)[number]['id']

export const PAYU_GST_EXEMPTION_REASONS = [
  {
    id: 'below_threshold',
    label: 'Turnover below GST threshold',
    hint: 'Typically ₹40 lakh (goods) / ₹20 lakh (services) — declare honestly.',
  },
  {
    id: 'exempt_category',
    label: 'Exempt / not required under GST law',
    hint: 'Category or supply is exempt from GST registration.',
  },
  {
    id: 'applied_awaiting',
    label: 'Applied for GSTIN — awaiting registration',
    hint: 'You can add the GSTIN later once it is issued.',
  },
] as const

export type PayuGstExemptionReason = (typeof PAYU_GST_EXEMPTION_REASONS)[number]['id']

export function gstEnrollmentLabel(value: string | null | undefined): string {
  return PAYU_GST_ENROLLMENTS.find((row) => row.id === value)?.label ?? 'Not declared'
}

export function gstExemptionReasonLabel(value: string | null | undefined): string {
  return (
    PAYU_GST_EXEMPTION_REASONS.find((row) => row.id === value)?.label ??
    (value && value.trim() ? value : '—')
  )
}

function baseCompanyReqs(
  entityId: number,
  summary: string,
  legalHint: string,
  cinPlaceholder = 'U12345MH2020PTC123456',
): EntityKycRequirements {
  return {
    entityId,
    group: 'company',
    summary,
    legalNameLabel: 'Company legal name',
    legalNameHint: legalHint,
    legalNamePlaceholder: 'Name on Certificate of Incorporation',
    tradeNameLabel: 'Trade / brand name',
    tradeNameHint: 'Name buyers see on the storefront. Not a trademark certificate.',
    tradeNamePlaceholder: 'Shop or brand name',
    panNameHint: 'Exact company name printed on the company PAN (4th letter C).',
    bankHolderHint: 'Must match company PAN name (company current account preferred).',
    registrationSectionTitle: 'Company registration',
    registrationSectionHint:
      'CIN + Certificate of Incorporation are required. GSTIN is optional if you are not registered under GST.',
    cinLabel: 'CIN',
    cinPlaceholder,
    llpinLabel: 'LLPIN',
    llpinPlaceholder: 'AAA-1234',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: 'Registration number',
    requiresCin: true,
    requiresLlpin: false,
    requiresRegistrationNumber: false,
    syncLegalWithPan: false,
    suggestGst: true,
    requiredAdminDocs: [
      { kind: 'incorporation', label: 'Certificate of Incorporation' },
      { kind: 'id_front', label: 'Authorized signatory government ID' },
    ],
    optionalAdminDocs: [
      { kind: 'ownership', label: 'Board resolution / authorization letter (optional)' },
    ],
  }
}

const ENTITY_REQUIREMENTS: Record<number, EntityKycRequirements> = {
  14: {
    entityId: 14,
    group: 'person',
    summary: 'Selling as yourself. Legal name = your PAN name.',
    legalNameLabel: 'Full legal name',
    legalNameHint: 'Your full legal name as on PAN (PayU account name). Not a brand or trademark.',
    legalNamePlaceholder: 'Name as on PAN',
    tradeNameLabel: 'Shop / display name',
    tradeNameHint: 'Name buyers see. Can differ from your legal name.',
    tradeNamePlaceholder: 'Shop name buyers see',
    panNameHint: 'Exact spelling as printed on your personal PAN.',
    bankHolderHint: 'Must match your PAN name or shop name.',
    registrationSectionTitle: 'Registration',
    registrationSectionHint: '',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: '',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: false,
    syncLegalWithPan: true,
    suggestGst: false,
    requiredAdminDocs: [],
    optionalAdminDocs: [{ kind: 'id_front', label: 'Government ID (Aadhaar / voter ID)' }],
  },
  2: {
    entityId: 2,
    group: 'person',
    summary: 'Sole proprietor — PAN is personal (4th letter P).',
    legalNameLabel: 'Proprietor legal name',
    legalNameHint: 'Proprietor name as on PAN (PayU account name). Not a brand or trademark.',
    legalNamePlaceholder: 'Proprietor name as on PAN',
    tradeNameLabel: 'Trade / shop name',
    tradeNameHint: 'Business name buyers see. Not a trademark certificate.',
    tradeNamePlaceholder: 'Shop or trade name',
    panNameHint: 'Exact spelling as printed on the proprietor PAN.',
    bankHolderHint: 'Must match PAN name or trade name.',
    registrationSectionTitle: 'Registration',
    registrationSectionHint: '',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: '',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: false,
    syncLegalWithPan: true,
    suggestGst: false,
    requiredAdminDocs: [],
    optionalAdminDocs: [{ kind: 'id_front', label: 'Government ID (Aadhaar / voter ID)' }],
  },
  10: {
    entityId: 10,
    group: 'person',
    summary: 'Hindu Undivided Family — PAN 4th letter must be H.',
    legalNameLabel: 'HUF legal name',
    legalNameHint: 'HUF name as on PAN (usually “X HUF”). PayU account name.',
    legalNamePlaceholder: 'e.g. Sharma HUF',
    tradeNameLabel: 'Trade / shop name',
    tradeNameHint: 'Name buyers see on the storefront.',
    tradeNamePlaceholder: 'Shop name buyers see',
    panNameHint: 'Exact HUF name printed on the HUF PAN.',
    bankHolderHint: 'Must match HUF PAN name or trade name.',
    registrationSectionTitle: 'Registration',
    registrationSectionHint: '',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: '',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: false,
    syncLegalWithPan: true,
    suggestGst: false,
    requiredAdminDocs: [],
    optionalAdminDocs: [{ kind: 'id_front', label: 'Karta government ID (optional)' }],
  },
  3: {
    entityId: 3,
    group: 'firm',
    summary: 'Partnership firm — PAN 4th letter F. Deed for admin. GSTIN only if registered.',
    legalNameLabel: 'Firm legal name',
    legalNameHint: 'Firm name as on the partnership deed (PayU account name).',
    legalNamePlaceholder: 'Name on partnership deed',
    tradeNameLabel: 'Trade / shop name',
    tradeNameHint: 'Name buyers see. Not a trademark certificate.',
    tradeNamePlaceholder: 'Shop or trade name',
    panNameHint: 'Exact firm name printed on the firm PAN.',
    bankHolderHint: 'Must match firm PAN name or trade name.',
    registrationSectionTitle: 'Firm documents',
    registrationSectionHint: 'Partnership deed is reviewed by SHEconomy admin.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: '',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: false,
    syncLegalWithPan: false,
    suggestGst: true,
    requiredAdminDocs: [{ kind: 'ownership', label: 'Partnership deed' }],
    optionalAdminDocs: [],
  },
  6: {
    entityId: 6,
    group: 'firm',
    summary: 'LLP — LLPIN + LLP agreement for admin. GSTIN only if registered.',
    legalNameLabel: 'LLP registered name',
    legalNameHint: 'LLP name as on MCA records (PayU account name).',
    legalNamePlaceholder: 'Registered LLP name',
    tradeNameLabel: 'Trade / brand name',
    tradeNameHint: 'Name buyers see. Not a trademark certificate.',
    tradeNamePlaceholder: 'Shop or brand name',
    panNameHint: 'Exact name printed on the LLP PAN.',
    bankHolderHint: 'Must match LLP PAN name or trade name.',
    registrationSectionTitle: 'LLP registration',
    registrationSectionHint: 'LLPIN and agreement are for SHEconomy admin review.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: 'AAA-1234',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: '',
    requiresCin: false,
    requiresLlpin: true,
    requiresRegistrationNumber: false,
    syncLegalWithPan: false,
    suggestGst: true,
    requiredAdminDocs: [{ kind: 'ownership', label: 'LLP agreement' }],
    optionalAdminDocs: [],
  },
  4: baseCompanyReqs(
    4,
    'Private Limited — company PAN (C), CIN (U…PTC…), COI, and authorized signatory ID. GSTIN only if registered.',
    'Company name exactly as on the Certificate of Incorporation (PayU account name).',
    'U12345MH2020PTC123456',
  ),
  5: {
    ...baseCompanyReqs(
      5,
      'Public Limited / Corporation — CIN starts with L; COI + signatory ID. GSTIN only if registered.',
      'Corporation / public limited name exactly as on the Certificate of Incorporation.',
      'L12345MH2020PLC123456',
    ),
    legalNameLabel: 'Corporation legal name',
  },
  16: {
    ...baseCompanyReqs(
      16,
      'One Person Company — CIN (OPC), COI + signatory ID. GSTIN only if registered.',
      'OPC name exactly as on the Certificate of Incorporation (PayU account name).',
      'U12345MH2020OPC123456',
    ),
    legalNameLabel: 'OPC legal name',
  },
  1: {
    entityId: 1,
    group: 'nonprofit',
    summary: 'Association of Persons — PAN 4th letter A. Registration proof for admin.',
    legalNameLabel: 'AOP legal name',
    legalNameHint: 'Registered AOP name for the PayU account.',
    legalNamePlaceholder: 'AOP registered name',
    tradeNameLabel: 'Public-facing name',
    tradeNameHint: 'Name buyers see on the storefront.',
    tradeNamePlaceholder: 'Display name',
    panNameHint: 'Exact name printed on the AOP PAN.',
    bankHolderHint: 'Must match AOP PAN name or display name.',
    registrationSectionTitle: 'AOP registration',
    registrationSectionHint: 'Registration proof is for SHEconomy admin review.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Registration number',
    registrationNumberPlaceholder: 'AOP / deed registration number',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: true,
    syncLegalWithPan: false,
    suggestGst: false,
    requiredAdminDocs: [{ kind: 'ownership', label: 'AOP registration / deed' }],
    optionalAdminDocs: [],
  },
  8: {
    entityId: 8,
    group: 'nonprofit',
    summary: 'Society — registration certificate required for admin.',
    legalNameLabel: 'Society legal name',
    legalNameHint: 'Registered society name (PayU account name).',
    legalNamePlaceholder: 'Registered society name',
    tradeNameLabel: 'Public-facing name',
    tradeNameHint: 'Name buyers see on the storefront.',
    tradeNamePlaceholder: 'Display name',
    panNameHint: 'Exact name printed on the society PAN.',
    bankHolderHint: 'Must match society PAN name or display name.',
    registrationSectionTitle: 'Society registration',
    registrationSectionHint: 'Certificate is for SHEconomy admin review.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Society registration number',
    registrationNumberPlaceholder: 'Society registration number',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: true,
    syncLegalWithPan: false,
    suggestGst: false,
    requiredAdminDocs: [{ kind: 'ownership', label: 'Society registration certificate' }],
    optionalAdminDocs: [],
  },
  7: {
    entityId: 7,
    group: 'nonprofit',
    summary: 'Trust — trust deed required for admin.',
    legalNameLabel: 'Trust legal name',
    legalNameHint: 'Registered trust name (PayU account name).',
    legalNamePlaceholder: 'Registered trust name',
    tradeNameLabel: 'Public-facing name',
    tradeNameHint: 'Name buyers see on the storefront.',
    tradeNamePlaceholder: 'Display name',
    panNameHint: 'Exact name printed on the trust PAN.',
    bankHolderHint: 'Must match trust PAN name or display name.',
    registrationSectionTitle: 'Trust registration',
    registrationSectionHint: 'Trust deed is for SHEconomy admin review.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'Trust registration number',
    registrationNumberPlaceholder: 'Trust registration number',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: true,
    syncLegalWithPan: false,
    suggestGst: false,
    requiredAdminDocs: [{ kind: 'ownership', label: 'Trust deed' }],
    optionalAdminDocs: [],
  },
  15: {
    entityId: 15,
    group: 'nonprofit',
    summary: 'NGO — registration proof for admin. PAN may be trust, society, or company type.',
    legalNameLabel: 'NGO legal name',
    legalNameHint: 'Registered NGO / nonprofit name (PayU account name).',
    legalNamePlaceholder: 'Registered NGO name',
    tradeNameLabel: 'Public-facing name',
    tradeNameHint: 'Name buyers see on the storefront.',
    tradeNamePlaceholder: 'Display name',
    panNameHint: 'Exact name printed on the NGO PAN.',
    bankHolderHint: 'Must match NGO PAN name or display name.',
    registrationSectionTitle: 'NGO registration',
    registrationSectionHint: 'Registration certificate is for SHEconomy admin review.',
    cinLabel: 'CIN',
    cinPlaceholder: '',
    llpinLabel: 'LLPIN',
    llpinPlaceholder: '',
    registrationNumberLabel: 'NGO registration number',
    registrationNumberPlaceholder: '12A / 80G / society / trust number',
    requiresCin: false,
    requiresLlpin: false,
    requiresRegistrationNumber: true,
    syncLegalWithPan: false,
    suggestGst: false,
    requiredAdminDocs: [{ kind: 'ownership', label: 'NGO registration certificate' }],
    optionalAdminDocs: [],
  },
}

export function entityLabel(businessEntityId: number): string {
  return PAYU_BUSINESS_ENTITIES.find((row) => row.id === businessEntityId)?.label ?? 'Business'
}

export function entityShortLabel(businessEntityId: number): string {
  const row = PAYU_BUSINESS_ENTITIES.find((entry) => entry.id === businessEntityId)
  return row?.shortLabel ?? row?.label ?? 'Business'
}

export function entityGroupForId(businessEntityId: number): EntityKycGroup | null {
  return PAYU_BUSINESS_ENTITIES.find((row) => row.id === businessEntityId)?.group ?? null
}

export function entitiesInGroup(group: EntityKycGroup) {
  return PAYU_BUSINESS_ENTITIES.filter((row) => row.group === group)
}

/** Keep the current entity when it already belongs to `group`; otherwise pick the first. */
export function pickEntityInGroup(
  group: EntityKycGroup,
  currentEntityId?: number | null,
): PayuBusinessEntityId {
  const inGroup = entitiesInGroup(group)
  const current = inGroup.find((row) => row.id === currentEntityId)
  return (current ?? inGroup[0]).id
}

const FALLBACK_ENTITY_REQS: EntityKycRequirements = {
  entityId: 0,
  group: 'person',
  summary: 'Choose a business type to see the fields PayU and admin need.',
  legalNameLabel: 'Legal name',
  legalNameHint: 'Legal name for the PayU payout account. Not a brand or trademark.',
  legalNamePlaceholder: 'Legal name for PayU',
  tradeNameLabel: 'Trade / business name',
  tradeNameHint: 'Shop / brand name buyers see. Not a trademark certificate.',
  tradeNamePlaceholder: 'Shop name buyers see',
  panNameHint: 'Exact spelling as printed on the PAN.',
  bankHolderHint: 'Must match PAN name or trade name.',
  registrationSectionTitle: 'Entity registration',
  registrationSectionHint: 'For SHEconomy admin review.',
  cinLabel: 'CIN',
  cinPlaceholder: 'U12345MH2020PTC123456',
  llpinLabel: 'LLPIN',
  llpinPlaceholder: 'AAA-1234',
  registrationNumberLabel: 'Registration number',
  registrationNumberPlaceholder: 'Registration number',
  requiresCin: false,
  requiresLlpin: false,
  requiresRegistrationNumber: false,
  syncLegalWithPan: false,
  suggestGst: false,
  requiredAdminDocs: [],
  optionalAdminDocs: [],
}

export function getEntityKycRequirements(businessEntityId: number): EntityKycRequirements {
  return ENTITY_REQUIREMENTS[businessEntityId] ?? { ...FALLBACK_ENTITY_REQS, entityId: businessEntityId }
}

export type PayuKycInput = {
  legalName: string
  mobile: string
  email: string
  panNumber: string
  panName: string
  /** @deprecated Prefer gstEnrollment. Kept for callers that still pass the toggle. */
  hasGst: boolean
  gstEnrollment: PayuGstEnrollment | ''
  gstExemptionReason: PayuGstExemptionReason | ''
  gstNumber: string
  businessName: string
  businessEntityId: number
  monthlyExpectedVolume: number
  bankAccountNumber: string
  bankHolderName: string
  ifsc: string
  cin: string
  llpin: string
  registrationNumber: string
  panDocumentPath: string
  bankDocumentPath: string
  gstDocumentPath: string
  scheduleCDocumentPath: string
  incorporationDocumentPath: string
  ownershipDocumentPath: string
  idFrontDocumentPath: string
  idBackDocumentPath: string
}

/** Resolve GST enrollment from new fields or legacy hasGst. */
export function resolveGstEnrollment(input: {
  gstEnrollment?: PayuGstEnrollment | '' | null
  hasGst?: boolean
}): PayuGstEnrollment | '' {
  if (input.gstEnrollment === 'registered' || input.gstEnrollment === 'not_registered') {
    return input.gstEnrollment
  }
  // Explicit empty string = form asked but user has not chosen yet.
  if (input.gstEnrollment === '') return ''
  if (input.hasGst === true) return 'registered'
  if (input.hasGst === false) return 'not_registered'
  return ''
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

/** Preferred PayU entity when only the PAN 4th letter is known. */
const PAN_DEFAULT_ENTITY: Record<string, number> = {
  P: 2, // Sole proprietorship — typical marketplace seller
  C: 4, // Private Limited
  F: 3, // Partnership
  T: 7, // Trust
  A: 1, // AOP
  H: 10, // HUF
}

/**
 * Keep the current entity when it already matches this PAN; otherwise pick the
 * marketplace default for that PAN letter.
 */
export function inferEntityFromPan(
  pan: string,
  currentEntityId?: number | null,
): number | null {
  const value = normalizePan(pan)
  if (!PAN_RE.test(value)) return null
  const letter = value[3] ?? ''
  const allowed = PAN_ENTITY_TYPES[letter]
  if (!allowed?.length) return null
  if (currentEntityId != null && allowed.includes(currentEntityId)) return currentEntityId
  return PAN_DEFAULT_ENTITY[letter] ?? allowed[0] ?? null
}

/**
 * Map GST registry `ctb` (constitution of business) onto a PayU entity id.
 * Masters India / GST portal strings vary; match loosely.
 */
const GST_CONSTITUTION_ENTITY: Array<{ pattern: RegExp; entityId: number }> = [
  { pattern: /one\s*person|\bopc\b/i, entityId: 16 },
  { pattern: /private\s*limited|pvt\.?\s*ltd/i, entityId: 4 },
  { pattern: /public\s*limited|public\s*company|corporation/i, entityId: 5 },
  { pattern: /limited\s*liability\s*partnership|\bllp\b/i, entityId: 6 },
  { pattern: /partnership/i, entityId: 3 },
  { pattern: /hindu\s*undivided|\bhuf\b/i, entityId: 10 },
  { pattern: /proprietorship|sole\s*prop/i, entityId: 2 },
  { pattern: /\bindividual\b/i, entityId: 14 },
  { pattern: /\btrust\b/i, entityId: 7 },
  { pattern: /\bsociety\b/i, entityId: 8 },
  { pattern: /association\s*of\s*persons|\baop\b/i, entityId: 1 },
  { pattern: /\bngo\b|non[\s-]*government|section\s*8/i, entityId: 15 },
]

export function inferEntityFromGstConstitution(constitution: string): number | null {
  const text = constitution.trim()
  if (!text) return null
  for (const row of GST_CONSTITUTION_ENTITY) {
    if (row.pattern.test(text)) return row.entityId
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

/** Every seller must reach `payu_verified` — missing KYC blocks selling. */
export function kycAllowsStorefront(status: PayuKycStatus | null | undefined): boolean {
  return status === 'payu_verified'
}

export function validatePayuKycInput(input: PayuKycInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const entity = getEntityKycRequirements(input.businessEntityId)

  if (!input.legalName.trim()) {
    errors.legalName = 'Enter the legal name for your PayU payout account.'
  }
  if (normalizeMobile(input.mobile).length !== 10) errors.mobile = 'Enter a 10-digit mobile number.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Enter a valid email.'
  if (!PAN_RE.test(normalizePan(input.panNumber))) errors.panNumber = 'Enter a valid PAN.'
  else {
    const panEntityError = verifyPanForEntity(input.panNumber, input.businessEntityId)
    if (panEntityError && panEntityError !== 'Enter a valid PAN.') errors.panNumber = panEntityError
  }
  if (!input.panName.trim()) errors.panName = 'Enter the exact name printed on the PAN card.'
  if (!input.businessName.trim()) errors.businessName = 'Enter the shop / trade name.'
  if (!PAYU_BUSINESS_ENTITIES.some((row) => row.id === input.businessEntityId)) {
    errors.businessEntityId = 'Choose a business type.'
  }
  if (!Number.isFinite(input.monthlyExpectedVolume) || input.monthlyExpectedVolume < 1) {
    errors.monthlyExpectedVolume = 'Enter expected monthly sales in rupees.'
  }

  if (entity.requiresCin) {
    const cin = verifyKycCin(input.cin)
    if (!cin.ok) errors.cin = cin.error
  }
  if (entity.requiresLlpin) {
    const llpin = verifyKycLlpin(input.llpin)
    if (!llpin.ok) errors.llpin = llpin.error
  }
  if (entity.requiresRegistrationNumber && !input.registrationNumber.trim()) {
    errors.registrationNumber = 'Enter the registration number.'
  }

  const gstEnrollment = resolveGstEnrollment(input)
  if (!gstEnrollment) {
    errors.gstEnrollment = 'Choose whether you have a GSTIN or are not registered under GST.'
  } else if (gstEnrollment === 'registered') {
    const gst = verifyGstin(input.gstNumber)
    if (!gst.ok) errors.gstNumber = gst.error
    else if (normalizePan(input.panNumber) !== gst.pan) {
      errors.panNumber = 'PAN must match the PAN on this GSTIN.'
    }
    if (!input.gstDocumentPath.trim()) errors.gstDocumentPath = 'Upload the GST certificate.'
  } else {
    const reasonOk = PAYU_GST_EXEMPTION_REASONS.some((row) => row.id === input.gstExemptionReason)
    if (!reasonOk) {
      errors.gstExemptionReason =
        'Select why you are not registered under GST (below threshold, exempt, or awaiting GSTIN).'
    }
  }
  if (!ACCOUNT_RE.test(input.bankAccountNumber.replace(/\s+/g, ''))) {
    errors.bankAccountNumber = 'Enter a 9–18 digit account number.'
  }
  if (!IFSC_RE.test(normalizeIfsc(input.ifsc))) errors.ifsc = 'Enter a valid IFSC.'
  if (!holderNameMatches(input.bankHolderName, input.panName, input.businessName)) {
    errors.bankHolderName = 'Account holder name must match the PAN name or trade name.'
  }
  if (!input.panDocumentPath.trim()) errors.panDocumentPath = 'Upload the PAN card.'
  if (!input.bankDocumentPath.trim()) errors.bankDocumentPath = 'Upload a cancelled cheque or bank proof.'
  if (!input.scheduleCDocumentPath.trim()) {
    errors.scheduleCDocumentPath = 'Upload the signed Schedule C document.'
  }

  const pathByKind: Record<string, { path: string; errorKey: string }> = {
    incorporation: {
      path: input.incorporationDocumentPath,
      errorKey: 'incorporationDocumentPath',
    },
    ownership: { path: input.ownershipDocumentPath, errorKey: 'ownershipDocumentPath' },
    id_front: { path: input.idFrontDocumentPath, errorKey: 'idFrontDocumentPath' },
    id_back: { path: input.idBackDocumentPath, errorKey: 'idBackDocumentPath' },
  }
  for (const doc of entity.requiredAdminDocs) {
    const entry = pathByKind[doc.kind]
    if (entry && !entry.path.trim()) {
      errors[entry.errorKey] = `Upload the ${doc.label.toLowerCase()}.`
    }
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
  gst_enrollment: PayuGstEnrollment | null
  gst_exemption_reason: PayuGstExemptionReason | null
  business_name: string
  business_entity_id: number
  monthly_expected_volume: number
  bank_account_number: string
  bank_holder_name: string
  ifsc: string
  cin: string | null
  llpin: string | null
  registration_number: string | null
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
  kind: PayuKycDocKind
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
