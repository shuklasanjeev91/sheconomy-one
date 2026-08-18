/**
 * Public carrier tracking URL templates (client + server safe).
 * Mirrors supabase/functions/_shared/courier-track.ts publicTrackingUrl.
 */

export function getPublicTrackingUrl(
  courierSlug: string | null | undefined,
  awb: string | null | undefined,
): string | null {
  const slug = (courierSlug ?? '').toLowerCase().trim()
  const id = encodeURIComponent((awb ?? '').trim())
  if (!slug || !id) return null

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

    // Legacy (not in picker; kept for existing deliveries)
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${id}`,
    'canada-post': `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${id}`,
    'australia-post': `https://auspost.com.au/mypost/track/details/${id}`,
  }

  return urls[slug] ?? null
}
