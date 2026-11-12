/**
 * Easyship Rates API — DDP landed cost quotes for checkout.
 * Docs: POST /2024-09/rates with incoterms DDP + calculate_tax_and_duties true.
 */

export type EasyshipConfig = {
  token: string
  baseUrl: string
}

export function resolveEasyshipConfig(): EasyshipConfig | null {
  const token = Deno.env.get('EASYSHIP_API_TOKEN')?.trim()
  if (!token) return null
  const baseUrl = (
    Deno.env.get('EASYSHIP_BASE_URL')?.trim() || 'https://public-api.easyship.com/2024-09'
  ).replace(/\/$/, '')
  return { token, baseUrl }
}

/** Cloudflare rejects bare Deno UA from some edges with 403/1010. */
function easyshipHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'SHEconomyOne/1.0 (Supabase Edge; Easyship)',
    ...extra,
  }
}

export type EasyshipAddress = {
  line_1?: string
  line_2?: string | null
  state?: string | null
  city?: string | null
  postal_code?: string | null
  country_alpha2: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
}

export type EasyshipParcelItem = {
  description: string
  category?: string
  sku?: string
  quantity: number
  dimensions?: { length: number; width: number; height: number }
  actual_weight?: number
  declared_currency: string
  declared_customs_value: number
  hs_code?: string
  origin_country_alpha2?: string
}

export type EasyshipRateRequest = {
  origin_address: EasyshipAddress
  destination_address: EasyshipAddress
  parcels: Array<{
    items: EasyshipParcelItem[]
    total_actual_weight?: number
  }>
  incoterms?: 'DDP' | 'DDU'
  calculate_tax_and_duties?: boolean
}

export type EasyshipRate = {
  courier_service?: { id?: string; name?: string; umbrella_name?: string }
  currency?: string
  total_charge?: number
  shipment_charge?: number
  fuel_surcharge?: number
  min_delivery_time?: number
  max_delivery_time?: number
  estimated_import_tax?: number | null
  estimated_import_duty?: number | null
  ddp_handling_fee?: number | null
  cost_rank?: number
  value_for_money_rank?: number
}

export type EasyshipRatesResponse = {
  rates?: EasyshipRate[]
  meta?: { request_id?: string }
  error?: { message?: string; details?: string[] | string; code?: string }
  message?: string
}

export type DdpShopQuote = {
  shop_id: string
  shipment_charge: number
  tax_amount: number
  duty_amount: number
  handling_fee: number
  shipping_amount: number
  total_charge: number
  currency: string
  courier_service_id: string | null
  courier_name: string | null
  estimated_days: number
  min_delivery_time: number | null
  max_delivery_time: number | null
}

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

export async function requestDdpRates(
  config: EasyshipConfig,
  body: EasyshipRateRequest,
): Promise<EasyshipRate[]> {
  const payload: EasyshipRateRequest = {
    ...body,
    incoterms: body.incoterms ?? 'DDP',
    calculate_tax_and_duties: body.calculate_tax_and_duties !== false,
  }

  const res = await fetch(`${config.baseUrl}/rates`, {
    method: 'POST',
    headers: easyshipHeaders(config.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  const json = (await res.json().catch(() => ({}))) as EasyshipRatesResponse
  if (!res.ok) {
    const details = json.error?.details
    const detailText = Array.isArray(details)
      ? details.filter(Boolean).join('; ')
      : typeof details === 'string'
        ? details
        : ''
    const base =
      json.error?.message || json.message || `Easyship rates failed (${res.status})`
    // India (and other BYO-courier origins) often return this when no own FedEx/UPS is linked.
    throw new Error(detailText ? `${base}: ${detailText}` : base)
  }
  return json.rates ?? []
}

/** Pick cheapest by cost_rank (1) else lowest total_charge. */
export function pickBestDdpRate(rates: EasyshipRate[]): EasyshipRate | null {
  if (!rates.length) return null
  const byRank = rates.find((r) => r.cost_rank === 1)
  if (byRank) return byRank
  return [...rates].sort(
    (a, b) => (a.total_charge ?? Number.POSITIVE_INFINITY) - (b.total_charge ?? Number.POSITIVE_INFINITY),
  )[0]
}

export function rateToDdpShopQuote(shopId: string, rate: EasyshipRate): DdpShopQuote {
  const shipment = round2(Number(rate.shipment_charge ?? rate.total_charge ?? 0))
  const tax = round2(Number(rate.estimated_import_tax ?? 0))
  const duty = round2(Number(rate.estimated_import_duty ?? 0))
  const handling = round2(Number(rate.ddp_handling_fee ?? 0))
  const total = round2(
    Number(rate.total_charge ?? shipment + tax + duty + handling),
  )
  const maxDays = rate.max_delivery_time ?? rate.min_delivery_time ?? 7
  return {
    shop_id: shopId,
    shipment_charge: shipment,
    tax_amount: tax,
    duty_amount: duty,
    handling_fee: handling,
    shipping_amount: shipment,
    total_charge: total,
    currency: (rate.currency || 'USD').toUpperCase(),
    courier_service_id: rate.courier_service?.id ?? null,
    courier_name:
      rate.courier_service?.name || rate.courier_service?.umbrella_name || null,
    estimated_days: Math.max(1, Number(maxDays) || 7),
    min_delivery_time: rate.min_delivery_time ?? null,
    max_delivery_time: rate.max_delivery_time ?? null,
  }
}

export const EASYSHIP_DEFAULT_WEIGHT_KG = 0.5
export const EASYSHIP_DEFAULT_DIMS = { length: 10, width: 10, height: 5 }

/** In-app recharge path for seller shipping credit (not Easyship dashboard). */
export const EASYSHIP_SELLER_RECHARGE_PATH = '/vendor/wallet'

export type EasyshipAccountCredit = {
  availableBalance: number
  balance: number
  currency: string
  raw: unknown
}

export async function getAccountCredit(config: EasyshipConfig): Promise<EasyshipAccountCredit> {
  const res = await fetch(`${config.baseUrl}/account`, {
    method: 'GET',
    headers: easyshipHeaders(config.token),
  })
  const json = (await res.json().catch(() => ({}))) as {
    account?: {
      credit?: { available_balance?: number; balance?: number; currency?: string }
    }
    error?: { message?: string }
    message?: string
  }
  if (!res.ok) {
    throw new Error(json.error?.message || json.message || `Easyship account failed (${res.status})`)
  }
  const credit = json.account?.credit
  return {
    availableBalance: Number(credit?.available_balance ?? 0) || 0,
    balance: Number(credit?.balance ?? 0) || 0,
    currency: String(credit?.currency || 'INR').toUpperCase(),
    raw: json,
  }
}

export type EasyshipCreateShipmentInput = {
  origin_address: EasyshipAddress & { company_name?: string }
  destination_address: EasyshipAddress & { company_name?: string }
  parcels: EasyshipRateRequest['parcels']
  courier_service_id?: string | null
  incoterms?: 'DDP' | 'DDU'
  calculate_tax_and_duties?: boolean
  buy_label?: boolean
}

export type EasyshipShipmentResult = {
  easyshipShipmentId: string
  trackingNumber: string | null
  labelUrl: string | null
  invoiceUrl: string | null
  labelState: string | null
  courierName: string | null
  totalCharge: number | null
  shipmentCharge: number | null
  currency: string | null
  raw: unknown
}

export async function createShipment(
  config: EasyshipConfig,
  input: EasyshipCreateShipmentInput,
): Promise<EasyshipShipmentResult> {
  const body: Record<string, unknown> = {
    origin_address: input.origin_address,
    destination_address: input.destination_address,
    parcels: input.parcels,
    incoterms: input.incoterms ?? 'DDP',
    calculate_tax_and_duties: input.calculate_tax_and_duties !== false,
    shipping_settings: {
      buy_label: input.buy_label !== false,
      buy_label_synchronous: true,
      printing_options: { format: 'url' },
    },
  }
  if (input.courier_service_id) {
    body.courier_settings = { courier_service_id: input.courier_service_id }
  }

  const res = await fetch(`${config.baseUrl}/shipments`, {
    method: 'POST',
    headers: easyshipHeaders(config.token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as { message?: string; details?: string[] | string } | undefined
    const details = err?.details
    const detailText = Array.isArray(details)
      ? details.filter(Boolean).join('; ')
      : typeof details === 'string'
        ? details
        : ''
    const base = err?.message || String(json.message || `Easyship shipment failed (${res.status})`)
    throw new Error(detailText ? `${base}: ${detailText}` : base)
  }

  const shipment = (json.shipment ?? json) as Record<string, unknown>
  const courier = (shipment.courier_service ?? shipment.courier ?? {}) as Record<string, unknown>
  const docs = (shipment.shipping_documents ?? shipment.label ?? null) as
    | Array<Record<string, unknown>>
    | Record<string, unknown>
    | null
  let labelUrl: string | null = null
  let invoiceUrl: string | null = null
  if (Array.isArray(docs)) {
    const labelDoc = docs.find((d) =>
      String(d.type || d.category || '').toLowerCase().includes('label'),
    )
    const invoiceDoc = docs.find((d) =>
      String(d.type || d.category || '').toLowerCase().includes('invoice'),
    )
    labelUrl = String(labelDoc?.url || labelDoc?.label_url || docs[0]?.url || '') ||
      null
    invoiceUrl = String(invoiceDoc?.url || invoiceDoc?.invoice_url || '') || null
  } else if (docs && typeof docs === 'object') {
    labelUrl = String(docs.url || docs.label_url || '') || null
    invoiceUrl = String(docs.invoice_url || '') || null
  }

  const easyshipShipmentId = String(
    shipment.easyship_shipment_id || shipment.id || '',
  )
  if (!easyshipShipmentId) {
    throw new Error('Easyship shipment created without id')
  }

  return {
    easyshipShipmentId,
    trackingNumber: shipment.tracking_number
      ? String(shipment.tracking_number)
      : shipment.track_number
        ? String(shipment.track_number)
        : null,
    labelUrl,
    invoiceUrl,
    labelState: shipment.label_state ? String(shipment.label_state) : null,
    courierName: String(courier.name || courier.umbrella_name || '') || null,
    totalCharge: Number.isFinite(Number(shipment.total_charge))
      ? Number(shipment.total_charge)
      : null,
    shipmentCharge: Number.isFinite(Number(shipment.shipment_charge))
      ? Number(shipment.shipment_charge)
      : null,
    currency: shipment.currency ? String(shipment.currency).toUpperCase() : null,
    raw: json,
  }
}

export function insufficientShippingCreditResponse(message?: string) {
  return {
    error: message || 'Insufficient Easyship shipping credit',
    code: 'insufficient_shipping_credit' as const,
    rechargeUrl: EASYSHIP_SELLER_RECHARGE_PATH,
  }
}
