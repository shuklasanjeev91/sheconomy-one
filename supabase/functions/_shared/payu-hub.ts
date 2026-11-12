/**
 * PayU Hub (accounts.payu.in) OAuth + onboarding APIs for child merchants.
 * @see https://docs.payu.in/reference/get-client-token-api
 * @see https://docs.payu.in/reference/sub-account-listing-api
 */

export type PayuHubConfig = {
  clientId: string
  clientSecret: string
  /** Parent product account MID / uuid used in Sub Account Listing path */
  parentMid: string
  hubBaseUrl: string
  onboardingBaseUrl: string
}

export type PayuChildMerchant = {
  mid: string
  merchantKey: string
  email: string | null
  name: string | null
  merchantDefinedIdentifier: string | null
  onboardingCompleted: boolean
  uuid: string | null
}

export function resolvePayuHubConfig(): PayuHubConfig | null {
  const clientId =
    Deno.env.get('PAYU_HUB_CLIENT_ID')?.trim() ||
    Deno.env.get('PAYU_CLIENT_ID')?.trim() ||
    ''
  const clientSecret =
    Deno.env.get('PAYU_HUB_CLIENT_SECRET')?.trim() ||
    Deno.env.get('PAYU_CLIENT_SECRET')?.trim() ||
    ''
  const parentMid =
    Deno.env.get('PAYU_LIVE_MID')?.trim() ||
    Deno.env.get('PAYU_PARENT_MID')?.trim() ||
    Deno.env.get('PAYU_MERCHANT_MID')?.trim() ||
    ''
  if (!clientId || !clientSecret || !parentMid) return null

  return {
    clientId,
    clientSecret,
    parentMid,
    hubBaseUrl:
      Deno.env.get('PAYU_HUB_BASE_URL')?.replace(/\/$/, '').trim() || 'https://accounts.payu.in',
    onboardingBaseUrl:
      Deno.env.get('PAYU_ONBOARDING_BASE_URL')?.replace(/\/$/, '').trim() ||
      'https://onboarding.payu.in',
  }
}

export async function getPayuHubToken(
  config: PayuHubConfig,
  scope: 'fetch_child_merchants' | 'refer_child_merchant' = 'fetch_child_merchants',
): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope,
  })
  const res = await fetch(`${config.hubBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const token = typeof json.access_token === 'string' ? json.access_token : ''
  if (!res.ok || !token) {
    throw new Error(
      String(json.error_description ?? json.error ?? `PayU Hub token failed (${res.status})`),
    )
  }
  return token
}

function parseChild(row: Record<string, unknown>): PayuChildMerchant | null {
  const midRaw = row.mid
  const mid = midRaw == null ? '' : String(midRaw).trim()
  const detail =
    row.product_account_detail && typeof row.product_account_detail === 'object'
      ? (row.product_account_detail as Record<string, unknown>)
      : {}
  const merchantKey =
    (typeof detail.pg_key === 'string' && detail.pg_key.trim()) ||
    (typeof row.pg_key === 'string' && row.pg_key.trim()) ||
    ''
  if (!mid || !merchantKey) return null
  return {
    mid,
    merchantKey,
    email: typeof row.email === 'string' ? row.email : null,
    name:
      (typeof row.name === 'string' && row.name) ||
      (typeof row.display_name === 'string' && row.display_name) ||
      null,
    merchantDefinedIdentifier:
      typeof row.merchant_defined_identifier === 'string'
        ? row.merchant_defined_identifier
        : null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    uuid: typeof row.uuid === 'string' ? row.uuid : null,
  }
}

function extractProductAccounts(json: Record<string, unknown>): Record<string, unknown>[] {
  const childMerchants = json.child_merchants
  if (childMerchants && typeof childMerchants === 'object') {
    const accounts = (childMerchants as Record<string, unknown>).product_accounts
    if (Array.isArray(accounts)) return accounts as Record<string, unknown>[]
  }
  if (Array.isArray(json.product_accounts)) return json.product_accounts as Record<string, unknown>[]
  if (Array.isArray(json.data)) return json.data as Record<string, unknown>[]
  return []
}

export async function listPayuChildMerchants(
  config: PayuHubConfig,
  accessToken: string,
  search?: { term: string; text: string },
): Promise<PayuChildMerchant[]> {
  const url = new URL(
    `${config.onboardingBaseUrl}/api/v3/product_accounts/${encodeURIComponent(config.parentMid)}/sub_accounts`,
  )
  if (search?.term && search?.text) {
    url.searchParams.set('search_term', search.term)
    url.searchParams.set('search_text', search.text)
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    json = {}
  }
  if (!res.ok) {
    throw new Error(
      String(json.message ?? json.error ?? json.status ?? `Sub-account listing failed (${res.status})`),
    )
  }

  return extractProductAccounts(json)
    .map(parseChild)
    .filter((row): row is PayuChildMerchant => Boolean(row))
}

export type PayuCreatedChild = {
  uuid: string
  mid: string
  onboardingStatus: string | null
  documentStatus: string | null
  kycStatus: string | null
}

function readProductAccount(json: Record<string, unknown>): Record<string, unknown> | null {
  const account = json.product_account
  if (account && typeof account === 'object') return account as Record<string, unknown>
  return null
}

function payuErrorMessage(json: Record<string, unknown>, status: number): string {
  if (typeof json.error === 'string' && json.error.trim()) return json.error
  if (json.errors && typeof json.errors === 'object') {
    const first = Object.values(json.errors as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  }
  if (typeof json.message === 'string' && json.message.trim()) return json.message
  return `PayU child merchant request failed (${status})`
}

function createdChildFromAccount(account: Record<string, unknown>): PayuCreatedChild {
  const midRaw = account.mid ?? account.identifier
  const kyc = account.kyc_status
  const kycStatus =
    kyc && typeof kyc === 'object'
      ? String((kyc as Record<string, unknown>).kyc_status ?? (kyc as Record<string, unknown>).status ?? '')
      : null
  return {
    uuid: typeof account.uuid === 'string' ? account.uuid : '',
    mid: midRaw == null ? '' : String(midRaw).trim(),
    onboardingStatus: typeof account.onboarding_status === 'string' ? account.onboarding_status : null,
    documentStatus: typeof account.document_status === 'string' ? account.document_status : null,
    kycStatus: kycStatus || null,
  }
}

/** POST /api/v3/product_accounts — scope refer_child_merchant. */
export async function createPayuChildMerchant(
  config: PayuHubConfig,
  accessToken: string,
  productAccount: Record<string, unknown>,
): Promise<PayuCreatedChild> {
  const res = await fetch(`${config.onboardingBaseUrl}/api/v3/product_accounts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ product_account: productAccount }),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const account = readProductAccount(json)
  if (!res.ok || !account) {
    throw new Error(payuErrorMessage(json, res.status))
  }
  const created = createdChildFromAccount(account)
  if (!created.uuid) throw new Error('PayU did not return a child merchant id.')
  return created
}

/** PUT bank details on the child product account. */
export async function updatePayuChildBank(
  config: PayuHubConfig,
  accessToken: string,
  productAccountUuid: string,
  bankDetail: { bank_account_number: string; holder_name: string; ifsc_code: string },
): Promise<PayuCreatedChild> {
  const res = await fetch(
    `${config.onboardingBaseUrl}/api/v3/product_accounts/${encodeURIComponent(productAccountUuid)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product_account: { bank_detail: bankDetail } }),
    },
  )
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const account = readProductAccount(json)
  if (!res.ok || !account) {
    throw new Error(payuErrorMessage(json, res.status))
  }
  return createdChildFromAccount(account)
}

export type PayuKycDocUploadResult = {
  uuid: string | null
  status: string | null
  error: string | null
}

const PARTNER_BASE =
  Deno.env.get('PAYU_PARTNER_BASE_URL')?.replace(/\/$/, '').trim() || 'https://partner.payu.in'

/** Map SHEconomy doc kinds to PayU Partner KYC category/type names. */
export function payuDocumentCategory(kind: 'pan' | 'bank' | 'schedule_c' | 'gst'): {
  category: string
  type: string
} {
  switch (kind) {
    case 'pan':
      return { category: 'PAN Card of Signing Authority', type: 'PAN Card' }
    case 'bank':
      return { category: 'Bank Account Proof', type: 'Canceled Cheque' }
    case 'schedule_c':
      return { category: 'Schedule C', type: 'Schedule C' }
    case 'gst':
      return { category: 'GST Certificate', type: 'GST Certificate' }
  }
}

/**
 * Upload one KYC document for a child merchant MID via Partner API.
 * Falls back to onboarding product-account document endpoint on 404/405.
 */
export async function uploadPayuKycDocument(
  config: PayuHubConfig,
  accessToken: string,
  input: {
    mid: string
    productAccountUuid?: string | null
    kind: 'pan' | 'bank' | 'schedule_c' | 'gst'
    fileName: string
    mimeType: string
    bytes: Uint8Array
  },
): Promise<PayuKycDocUploadResult> {
  const mapping = payuDocumentCategory(input.kind)
  const form = new FormData()
  form.append('merchant[document_category]', mapping.category)
  form.append('merchant[document_type]', mapping.type)
  form.append(
    'merchant[processed_document]',
    new Blob([input.bytes], { type: input.mimeType || 'application/pdf' }),
    input.fileName || `${input.kind}.pdf`,
  )

  const partnerUrl = `${PARTNER_BASE}/api/v3/merchants/${encodeURIComponent(input.mid)}/kyc_document`
  let res = await fetch(partnerUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  let json = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok && input.productAccountUuid && (res.status === 404 || res.status === 405 || res.status === 422)) {
    const onboardingForm = new FormData()
    onboardingForm.append('document_category', mapping.category)
    onboardingForm.append('document_type', mapping.type)
    onboardingForm.append(
      'document',
      new Blob([input.bytes], { type: input.mimeType || 'application/pdf' }),
      input.fileName || `${input.kind}.pdf`,
    )
    res = await fetch(
      `${config.onboardingBaseUrl}/api/v3/product_accounts/${encodeURIComponent(input.productAccountUuid)}/documents`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: onboardingForm,
      },
    )
    json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  if (!res.ok) {
    return {
      uuid: null,
      status: null,
      error: payuErrorMessage(json, res.status),
    }
  }

  const merchant =
    json.merchant && typeof json.merchant === 'object'
      ? (json.merchant as Record<string, unknown>)
      : json
  return {
    uuid:
      (typeof merchant.kyc_document_uuid === 'string' && merchant.kyc_document_uuid) ||
      (typeof merchant.uuid === 'string' && merchant.uuid) ||
      null,
    status:
      (typeof merchant.kyc_document_status === 'string' && merchant.kyc_document_status) ||
      (typeof merchant.document_status === 'string' && merchant.document_status) ||
      'DOCUMENT_SUBMITTED',
    error: null,
  }
}

/** GET product account details for KYC / onboarding status polling. */
export async function fetchPayuProductAccount(
  config: PayuHubConfig,
  accessToken: string,
  productAccountUuid: string,
): Promise<PayuCreatedChild & { raw: Record<string, unknown> }> {
  const res = await fetch(
    `${config.onboardingBaseUrl}/api/v3/product_accounts/${encodeURIComponent(productAccountUuid)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const account = readProductAccount(json) ?? (json as Record<string, unknown>)
  if (!res.ok) {
    throw new Error(payuErrorMessage(json, res.status))
  }
  return { ...createdChildFromAccount(account), raw: account }
}

/** Prefer shop-id match, then email, then phone. */
export async function findPayuChildForShop(
  config: PayuHubConfig,
  accessToken: string,
  input: { shopId: string; email?: string | null; phone?: string | null },
): Promise<PayuChildMerchant | null> {
  const shopKey = input.shopId.replace(/-/g, '')
  const attempts: Array<{ term: string; text: string }> = [
    { term: 'merchant_defined_identifier', text: input.shopId },
    { term: 'merchant_defined_identifier', text: shopKey },
    { term: 'identifier', text: input.shopId },
  ]
  if (input.email?.trim()) {
    attempts.push({ term: 'email', text: input.email.trim() })
  }
  if (input.phone?.trim()) {
    const digits = input.phone.replace(/\D/g, '')
    const phone = digits.length > 10 ? digits.slice(-10) : digits
    if (phone) attempts.push({ term: 'phone', text: phone })
  }

  for (const attempt of attempts) {
    try {
      const rows = await listPayuChildMerchants(config, accessToken, attempt)
      if (rows.length === 1) return rows[0]!
      if (rows.length > 1) {
        const byId = rows.find(
          (r) =>
            r.merchantDefinedIdentifier === input.shopId ||
            r.merchantDefinedIdentifier === shopKey,
        )
        if (byId) return byId
        if (input.email) {
          const byEmail = rows.find(
            (r) => r.email?.toLowerCase() === input.email!.trim().toLowerCase(),
          )
          if (byEmail) return byEmail
        }
        return rows[0]!
      }
    } catch {
      // try next search strategy
    }
  }
  return null
}
