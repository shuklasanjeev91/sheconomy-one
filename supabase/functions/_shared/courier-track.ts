/**
 * Courier tracking adapter.
 * Priority: direct courier API → AfterShip → TrackingMore → public URL.
 */

export type DeliveryStatusCanonical =
  | 'pending'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned_to_sender'
  | 'lost'
  | 'damaged'
  | 'cancelled'

export type TrackProvider =
  | 'shiprocket'
  | 'delhivery'
  | 'dtdc'
  | 'xpressbees'
  | 'bluedart'
  | 'ecomexpress'
  | 'aftership'
  | 'trackingmore'
  | 'public_url'
  | 'none'

export type TrackResult = {
  status: DeliveryStatusCanonical
  trackingUrl: string | null
  carrierSlug: string | null
  checkpoint: string | null
  provider: TrackProvider
  raw?: unknown
}

/** Our slug → AfterShip carrier slug */
const AFTERSHIP_SLUG: Record<string, string> = {
  fedex: 'fedex',
  ups: 'ups',
  usps: 'usps',
  dhl: 'dhl',
  'dhl-ecommerce': 'dhl-ecommerce',
  aramex: 'aramex',
  tnt: 'tnt',
  dpd: 'dpd',
  evri: 'hermes',
  'sf-express': 'sf-express',
  'canada-post': 'canada-post',
  'australia-post': 'australia-post',
  bluedart: 'bluedart',
  delhivery: 'delhivery',
  dtdc: 'dtdc',
  ecomexpress: 'ecom-express',
  indiapost: 'india-post',
  xpressbees: 'xpressbees',
  'professional-couriers': 'professional-couriers',
  ekart: 'ekart',
  shadowfax: 'shadowfax',
  gati: 'gati-kwe',
  safexpress: 'safexpress',
  trackon: 'trackon',
  dotzot: 'dotzot',
  'shree-maruti': 'shree-maruti-courier',
  jtexpress: 'jtexpress',
  'amazon-shipping': 'amazon',
  borzo: 'borzo',
  loadshare: 'loadshare',
  criticalog: 'criticalog',
  rivigo: 'rivigo',
  shiprocket: 'shiprocket',
  pickrr: 'pickrr',
}

export const STATUS_RANK: Record<DeliveryStatusCanonical, number> = {
  pending: 0,
  shipped: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  failed_delivery: 3,
  returned_to_sender: 5,
  lost: 5,
  damaged: 5,
  cancelled: 5,
}

export function shouldUpgradeStatus(
  current: string | null | undefined,
  next: DeliveryStatusCanonical,
): boolean {
  if (!current) return true
  if (current === next) return false
  const curRank = STATUS_RANK[current as DeliveryStatusCanonical]
  if (curRank == null) return true
  if (
    next === 'failed_delivery' ||
    next === 'returned_to_sender' ||
    next === 'lost' ||
    next === 'damaged'
  ) {
    return curRank < STATUS_RANK.delivered
  }
  return STATUS_RANK[next] > curRank
}

export function mapCarrierStatus(raw: string | null | undefined): DeliveryStatusCanonical {
  const s = (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
  if (!s) return 'shipped'
  if (s.includes('deliver') && !s.includes('fail') && !s.includes('undeliver')) return 'delivered'
  if (s.includes('outfordelivery') || s.includes('ofd')) return 'out_for_delivery'
  if (
    s.includes('intransit') ||
    s.includes('picked') ||
    s.includes('dispatched') ||
    s.includes('transit') ||
    s.includes('manifest') ||
    s.includes('leftfacility') ||
    s.includes('arrived')
  ) {
    return 'in_transit'
  }
  if (s.includes('fail') || s.includes('attempt') || s.includes('undeliver') || s.includes('ndr')) {
    return 'failed_delivery'
  }
  if (s.includes('rto') || s.includes('return') || s.includes('rts')) return 'returned_to_sender'
  if (s.includes('lost')) return 'lost'
  if (s.includes('damag')) return 'damaged'
  if (s.includes('cancel')) return 'cancelled'
  if (
    s.includes('shipped') ||
    s.includes('booked') ||
    s.includes('pending') ||
    s.includes('created') ||
    s.includes('inforeceived')
  ) {
    return 'shipped'
  }
  return 'in_transit'
}

export function mapAftershipTag(tag: string | null | undefined): DeliveryStatusCanonical {
  switch ((tag ?? '').toLowerCase()) {
    case 'delivered':
      return 'delivered'
    case 'outfordelivery':
      return 'out_for_delivery'
    case 'intransit':
    case 'availableforpickup':
      return 'in_transit'
    case 'attemptfail':
    case 'exception':
      return 'failed_delivery'
    case 'expired':
      return 'lost'
    case 'inforeceived':
    case 'pending':
      return 'shipped'
    default:
      return mapCarrierStatus(tag)
  }
}

export function publicTrackingUrl(courierSlug: string | null, awb: string): string | null {
  const slug = (courierSlug ?? '').toLowerCase()
  const id = encodeURIComponent(awb.trim())
  if (!id) return null
  const urls: Record<string, string> = {
    // Domestic — India
    delhivery: `https://www.delhivery.com/track/package/${id}`,
    dtdc: `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${id}`,
    bluedart: `https://www.bluedart.com/tracking?trackFor=0&trackNo=${id}`,
    xpressbees: `https://www.xpressbees.com/track?isNewTrack=true&trackingNumber=${id}`,
    ecomexpress: `https://ecomexpress.in/tracking/?awb_field=${id}`,
    indiapost: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
    ekart: `https://www.flipkart.com/tracking?id=${id}`,
    shadowfax: `https://track.shadowfax.in/?trackingId=${id}`,
    gati: `https://www.gati.com/track-shipment/?docket=${id}`,
    safexpress: `https://www.safexpress.com/track-shipment/?cn=${id}`,
    trackon: `https://trackon.in/tracking/?awbno=${id}`,
    jtexpress: `https://www.jtexpress.co.in/trajectoryQuery?billcode=${id}`,
    'amazon-shipping': `https://www.amazon.in/progress-tracker/package?trackingId=${id}`,
    'professional-couriers': `https://www.tpcindia.com/track.aspx?id=${id}`,
    dotzot: `https://dotzot.in/tracking?awb=${id}`,
    loadshare: `https://loadshare.net/track/${id}`,
    borzo: `https://borzodelivery.com/in/tracking?order=${id}`,
    dunzo: `https://www.dunzo.com/tracking/${id}`,
    'shree-maruti': `https://www.shreemaruticourier.com/track-shipment/?awbno=${id}`,
    criticalog: `https://www.criticalog.com/track/?awb=${id}`,
    rivigo: `https://www.rivigo.com/track?id=${id}`,
    'wow-express': `https://wowexpress.in/track/?awb=${id}`,
    shiprocket: `https://shiprocket.co/tracking/${id}`,
    pickrr: `https://shiprocket.co/tracking/${id}`,

    // International
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${id}`,
    ups: `https://www.ups.com/track?tracknum=${id}`,
    dhl: `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${id}`,
    'dhl-ecommerce': `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${id}`,
    aramex: `https://www.aramex.com/track/results?ShipmentNumber=${id}`,
    tnt: `https://www.tnt.com/express/en_in/site/shipping-tools/tracking.html?searchType=con&cons=${id}`,
    dpd: `https://www.dpd.com/tracking/?parcelNumber=${id}`,
    evri: `https://www.evri.com/track/parcel/${id}`,
    'sf-express': `https://www.sf-express.com/cn/en/dynamic_function/waybill/#search/bill-number/${id}`,

    // Legacy (not in picker)
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${id}`,
    'canada-post': `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${id}`,
    'australia-post': `https://auspost.com.au/mypost/track/details/${id}`,
  }
  return urls[slug] ?? null
}

function okResult(
  provider: TrackProvider,
  courierSlug: string | null,
  awb: string,
  statusRaw: string,
  checkpoint: string | null,
  raw: unknown,
  trackingUrl?: string | null,
  statusOverride?: DeliveryStatusCanonical,
): TrackResult {
  return {
    status: statusOverride ?? mapCarrierStatus(statusRaw),
    trackingUrl: trackingUrl ?? publicTrackingUrl(courierSlug, awb),
    carrierSlug: courierSlug,
    checkpoint: checkpoint || statusRaw || null,
    provider,
    raw,
  }
}

async function trackViaDelhivery(awb: string): Promise<TrackResult | null> {
  const token = Deno.env.get('DELHIVERY_API_TOKEN')
  try {
    const res = await fetch(
      `https://dlv-api.delhivery.com/v3/unified-tracking?wbn=${encodeURIComponent(awb)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (res.ok) {
      const raw = await res.json()
      const data = (raw as { data?: Record<string, unknown> }).data ?? (raw as Record<string, unknown>)
      const shipment =
        (data.shipment_data as Array<Record<string, unknown>> | undefined)?.[0] ?? data
      const statusObj =
        (shipment?.shipment as Record<string, unknown> | undefined)?.status ??
        shipment?.status ??
        data.status
      const statusRaw =
        typeof statusObj === 'object' && statusObj
          ? String(
              (statusObj as Record<string, unknown>).status ??
                (statusObj as Record<string, unknown>).status_type ??
                '',
            )
          : String(statusObj ?? '')
      const scans =
        (shipment?.scan_detail as Array<Record<string, unknown>> | undefined) ??
        (data.scans as Array<Record<string, unknown>> | undefined)
      const last = scans?.[0]
      if (statusRaw || last) {
        return okResult(
          'delhivery',
          'delhivery',
          awb,
          statusRaw || String(last?.ScanType ?? last?.status ?? 'in_transit'),
          last ? String(last.Instructions ?? last.Scan ?? last.status ?? '') : null,
          raw,
        )
      }
    }
  } catch {
    // continue
  }

  if (!token) return null
  const res = await fetch(
    `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(awb)}&verbose=2`,
    { headers: { Authorization: `Token ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const raw = await res.json()
  const row = (raw as { ShipmentData?: Array<{ Shipment?: Record<string, unknown> }> }).ShipmentData?.[0]
    ?.Shipment
  if (!row) return null
  const statusBlock = row.Status as Record<string, unknown> | string | undefined
  const statusRaw =
    typeof statusBlock === 'object' && statusBlock
      ? String(statusBlock.Status ?? statusBlock.status ?? '')
      : String(statusBlock ?? '')
  return okResult('delhivery', 'delhivery', awb, statusRaw, statusRaw, raw)
}

async function trackViaDtdc(awb: string): Promise<TrackResult | null> {
  const apiKey = Deno.env.get('DTDC_API_KEY')
  if (!apiKey) return null
  try {
    const res = await fetch(
      'https://alphademodashboardapi.shipsy.io/api/customer/integration/consignment/track',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({ reference_number: awb }),
      },
    )
    if (!res.ok) return null
    const raw = await res.json()
    const track =
      (raw as { data?: Array<Record<string, unknown>> }).data?.[0] ?? (raw as Record<string, unknown>)
    const statusRaw = String(track?.current_status ?? track?.status ?? track?.consignment_status ?? '')
    if (!statusRaw) return null
    return okResult('dtdc', 'dtdc', awb, statusRaw, statusRaw, raw)
  } catch {
    return null
  }
}

async function trackViaXpressbees(awb: string): Promise<TrackResult | null> {
  const token = Deno.env.get('XPRESSBEES_TOKEN') ?? Deno.env.get('XB_TOKEN')
  if (!token) return null
  try {
    const res = await fetch('https://shipment.xpressbees.com/api/courier/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ awb_number: awb }),
    })
    if (!res.ok) return null
    const raw = await res.json()
    const data = (raw as { data?: Record<string, unknown> | Array<Record<string, unknown>> }).data
    const row = Array.isArray(data) ? data[0] : data
    const statusRaw = String(row?.status ?? row?.current_status ?? row?.shipment_status ?? '')
    if (!statusRaw) return null
    return okResult('xpressbees', 'xpressbees', awb, statusRaw, statusRaw, raw)
  } catch {
    return null
  }
}

async function trackViaBluedart(awb: string): Promise<TrackResult | null> {
  const loginId = Deno.env.get('BLUEDART_LOGIN_ID')
  const licenseKey = Deno.env.get('BLUEDART_LICENSE_KEY')
  if (!loginId || !licenseKey) return null
  try {
    const res = await fetch(
      `https://api.bluedart.com/servlet/RoutingServlet?handler=tnt&action=custawbquery&loginid=${encodeURIComponent(loginId)}&awb=awb&numbers=${encodeURIComponent(awb)}&format=xml&lickey=${encodeURIComponent(licenseKey)}&verno=1.3&scan=1`,
    )
    if (!res.ok) return null
    const text = await res.text()
    const statusMatch =
      text.match(/<Status[^>]*>([^<]+)<\/Status>/i) ??
      text.match(/<StatusType[^>]*>([^<]+)<\/StatusType>/i)
    if (!statusMatch?.[1]) return null
    return okResult('bluedart', 'bluedart', awb, statusMatch[1], statusMatch[1], {
      xml: text.slice(0, 2000),
    })
  } catch {
    return null
  }
}

async function trackViaEcomExpress(awb: string): Promise<TrackResult | null> {
  const username = Deno.env.get('ECOM_EXPRESS_USERNAME')
  const password = Deno.env.get('ECOM_EXPRESS_PASSWORD')
  if (!username || !password) return null
  try {
    const res = await fetch(
      `https://plapi.ecomexpress.in/track_me/api/mawbd/?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&awb=${encodeURIComponent(awb)}`,
    )
    if (!res.ok) return null
    const raw = await res.json()
    const row = Array.isArray(raw) ? raw[0] : raw
    const statusRaw = String(
      (row as Record<string, unknown>)?.status ??
        (row as Record<string, unknown>)?.current_status ??
        '',
    )
    if (!statusRaw) return null
    return okResult('ecomexpress', 'ecomexpress', awb, statusRaw, statusRaw, raw)
  } catch {
    return null
  }
}

function parseAftershipPayload(json: unknown, courierSlug: string | null, awb: string): TrackResult {
  const root = json as {
    data?: { tracking?: Record<string, unknown>; trackings?: Array<Record<string, unknown>> }
  }
  const tracking =
    root.data?.tracking ??
    root.data?.trackings?.[0] ??
    (json as { data?: Record<string, unknown> }).data ??
    {}
  const tag = String(tracking.tag ?? tracking.subtag ?? '')
  const checkpoints = tracking.checkpoints as Array<Record<string, unknown>> | undefined
  const last = checkpoints?.[0]
  return {
    status: mapAftershipTag(tag),
    trackingUrl:
      typeof tracking.courier_tracking_link === 'string'
        ? tracking.courier_tracking_link
        : publicTrackingUrl(courierSlug, awb),
    carrierSlug: typeof tracking.slug === 'string' ? tracking.slug : courierSlug,
    checkpoint: last
      ? String(last.message ?? last.checkpoint_message ?? last.tag ?? '')
      : tag || null,
    provider: 'aftership',
    raw: json,
  }
}

async function trackViaAftership(
  trackingNumber: string,
  courierSlug: string | null,
): Promise<TrackResult | null> {
  const apiKey = Deno.env.get('AFTERSHIP_API_KEY')
  if (!apiKey) return null

  const slug = courierSlug && courierSlug !== 'other' ? AFTERSHIP_SLUG[courierSlug] ?? courierSlug : null
  const headers = {
    'Content-Type': 'application/json',
    'as-api-key': apiKey,
    'aftership-api-key': apiKey,
  }

  await fetch('https://api.aftership.com/tracking/2024-01/trackings', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tracking: {
        tracking_number: trackingNumber,
        ...(slug ? { slug } : {}),
      },
    }),
  }).catch(() => null)

  const path = slug
    ? `https://api.aftership.com/tracking/2024-01/trackings/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}`
    : `https://api.aftership.com/tracking/2024-01/trackings?tracking_numbers=${encodeURIComponent(trackingNumber)}`

  const res = await fetch(path, { headers })
  if (res.ok) return parseAftershipPayload(await res.json(), courierSlug, trackingNumber)

  const v4path = slug
    ? `https://api.aftership.com/v4/trackings/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}`
    : `https://api.aftership.com/v4/trackings?keyword=${encodeURIComponent(trackingNumber)}`
  const v4 = await fetch(v4path, {
    headers: { 'Content-Type': 'application/json', 'aftership-api-key': apiKey },
  })
  if (!v4.ok) return null
  return parseAftershipPayload(await v4.json(), courierSlug, trackingNumber)
}

async function trackViaTrackingMore(
  trackingNumber: string,
  courierSlug: string | null,
): Promise<TrackResult | null> {
  const apiKey = Deno.env.get('TRACKINGMORE_API_KEY')
  if (!apiKey) return null

  const headers = {
    'Content-Type': 'application/json',
    'Tracking-Api-Key': apiKey,
  }

  await fetch('https://api.trackingmore.com/v4/trackings/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tracking_number: trackingNumber,
      ...(courierSlug && courierSlug !== 'other' ? { courier_code: courierSlug } : {}),
    }),
  }).catch(() => null)

  const res = await fetch(
    `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${encodeURIComponent(trackingNumber)}`,
    { headers },
  )
  if (!res.ok) return null
  const json = await res.json()
  const item = (json as { data?: Array<Record<string, unknown>> }).data?.[0]
  if (!item) return null
  const statusRaw = String(item.delivery_status ?? item.status ?? '')
  const events = item.origin_info as { trackinfo?: Array<Record<string, unknown>> } | undefined
  const last = events?.trackinfo?.[0]
  return okResult(
    'trackingmore',
    courierSlug,
    trackingNumber,
    statusRaw,
    last ? String(last.StatusDescription ?? last.checkpoint_status ?? '') : statusRaw,
    json,
    typeof item.tracking_link === 'string' ? item.tracking_link : null,
  )
}

async function trackViaCourierDirect(
  courierSlug: string,
  awb: string,
): Promise<TrackResult | null> {
  switch (courierSlug) {
    case 'delhivery':
      return trackViaDelhivery(awb)
    case 'dtdc':
      return trackViaDtdc(awb)
    case 'xpressbees':
      return trackViaXpressbees(awb)
    case 'bluedart':
      return trackViaBluedart(awb)
    case 'ecomexpress':
      return trackViaEcomExpress(awb)
    default:
      return null
  }
}

/**
 * Track one AWB. Aggregators cover any courier; direct APIs used when available.
 */
export async function trackShipment(input: {
  trackingNumber: string
  courierSlug?: string | null
}): Promise<TrackResult> {
  const trackingNumber = input.trackingNumber.trim()
  const courierSlug = (input.courierSlug ?? '').toLowerCase() || null

  if (!trackingNumber) {
    return {
      status: 'pending',
      trackingUrl: null,
      carrierSlug: null,
      checkpoint: null,
      provider: 'none',
    }
  }

  if (courierSlug) {
    const direct = await trackViaCourierDirect(courierSlug, trackingNumber)
    if (direct) return direct
  }

  const aftership = await trackViaAftership(trackingNumber, courierSlug)
  if (aftership) return aftership

  const trackingmore = await trackViaTrackingMore(trackingNumber, courierSlug)
  if (trackingmore) return trackingmore

  // Delhivery public fallback when slug missing/wrong
  if (!courierSlug || courierSlug === 'delhivery' || courierSlug === 'other') {
    const del = await trackViaDelhivery(trackingNumber)
    if (del) return del
  }

  const publicUrl = publicTrackingUrl(courierSlug, trackingNumber)
  return {
    status: 'shipped',
    trackingUrl: publicUrl,
    carrierSlug: courierSlug,
    checkpoint: null,
    provider: publicUrl ? 'public_url' : 'none',
  }
}
