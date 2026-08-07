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
