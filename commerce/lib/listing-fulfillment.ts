import type { Json } from '~/lib/supabase'
import { formatCurrency } from '~/lib/format'

import {
  resolveTransitDaysForShop,
  type ShopShippingSummary,
} from '~/commerce/lib/shop-shipping'

export type DeliveryProfile = {
  id: string
  profile_name: string
  processing_time_min: number
  processing_time_max: number
  fixed_fee: number | null
  free_shipping_threshold: number | null
  shipping_rate_type: string | null
  delivery_metadata: Json
  is_default?: boolean
  is_active?: boolean
}

export type ListingFulfillmentInput = {
  listingType: string
  shippingRequired?: boolean | null
  price: number
  currency?: string
  digitalFileType?: string | null
  digitalFileSize?: number | null
  digitalFileUrl?: string | null
  downloadLimit?: number | null
  listingMetadata?: Json | null
  deliveryProfiles?: DeliveryProfile[]
  shopDeliveryProfiles?: DeliveryProfile[]
  listingDeliveryProfiles?: DeliveryProfile[]
  shopShipping?: ShopShippingSummary | null
  shipsFromCity?: string | null
}

export type PhysicalFulfillmentInfo = {
  kind: 'physical'
  processingLabel: string
  estimatedDeliveryLabel: string
  shippingCostLabel: string
  shipsFromLabel?: string
  returnsLabel?: string
  providerLabel?: string
  hasDeliveryEstimate: boolean
}

export type DigitalFulfillmentInfo = {
  kind: 'digital'
  deliveryLabel: string
  fileTypeLabel?: string
  fileSizeLabel?: string
  downloadLimitLabel?: string
  instantDownload: boolean
}

export type ListingFulfillmentInfo = PhysicalFulfillmentInfo | DigitalFulfillmentInfo

type DeliveryMetadata = {
  processing_days_min?: number
  processing_days_max?: number
  transit_days_min?: number
  transit_days_max?: number
  ships_from?: string
  returns_policy?: string
}

export function isPhysicalListing(listingType?: string | null) {
  return listingType !== 'digital'
}

export function isDigitalListing(listingType?: string | null) {
  return listingType === 'digital'
}

function parseMetadata(metadata: Json | null | undefined): DeliveryMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return metadata as DeliveryMetadata
}

function addBusinessDays(start: Date, days: number) {
  const date = new Date(start)
  let added = 0
  while (added < days) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) added += 1
  }
  return date
}

function formatDateRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startFmt = start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  const endFmt = end.toLocaleDateString('en-IN', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  })
  return sameMonth ? `${startFmt}–${endFmt}` : `${startFmt} – ${endFmt}`
}

function formatProcessingTime(min: number, max: number) {
  if (min <= 0 && max <= 0) return 'Ready to ship soon'
  if (min === max) return `${min} business day${min === 1 ? '' : 's'}`
  return `${min}–${max} business days`
}

export function formatFileSize(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function resolveDeliveryProfile(input: ListingFulfillmentInput): DeliveryProfile | null {
  const linked = input.listingDeliveryProfiles?.[0] ?? input.deliveryProfiles?.[0]
  if (linked) return linked

  const shopProfiles = (
    input.shopShipping?.deliveryProfiles ??
    input.shopDeliveryProfiles ??
    []
  ).filter((profile) => profile.is_active !== false)

  return shopProfiles.find((profile) => profile.is_default) ?? shopProfiles[0] ?? null
}

export function buildListingFulfillmentInfo(input: ListingFulfillmentInput): ListingFulfillmentInfo | null {
  if (isDigitalListing(input.listingType)) {
    const fileType = input.digitalFileType?.trim()
    const fileSize = formatFileSize(input.digitalFileSize)
    const hasFile = !!input.digitalFileUrl?.trim()

    return {
      kind: 'digital',
      deliveryLabel: hasFile ? 'Instant download' : 'Digital delivery',
      fileTypeLabel: fileType ? `Digital file type: ${fileType.toUpperCase()}` : undefined,
      fileSizeLabel: fileSize ? `File size: ${fileSize}` : undefined,
      downloadLimitLabel:
        input.downloadLimit != null && input.downloadLimit > 0
          ? `${input.downloadLimit} download${input.downloadLimit === 1 ? '' : 's'} included`
          : 'Unlimited downloads',
      instantDownload: true,
    }
  }

  if (!isPhysicalListing(input.listingType) && input.shippingRequired === false) {
    return null
  }

  const profile = resolveDeliveryProfile(input)
  const listingMeta = parseMetadata(input.listingMetadata)
  const profileMeta = parseMetadata(profile?.delivery_metadata as Json)

  const processingMin =
    profile?.processing_time_min ??
    listingMeta.processing_days_min ??
    profileMeta.processing_days_min ??
    0
  const processingMax =
    profile?.processing_time_max ??
    listingMeta.processing_days_max ??
    profileMeta.processing_days_max ??
    processingMin

  const transit =
    input.shopShipping != null
      ? resolveTransitDaysForShop(input.shopShipping, profile, {
          transit_days_min: listingMeta.transit_days_min ?? profileMeta.transit_days_min,
          transit_days_max: listingMeta.transit_days_max ?? profileMeta.transit_days_max,
        })
      : listingMeta.transit_days_min != null
        ? {
            min: listingMeta.transit_days_min,
            max: listingMeta.transit_days_max ?? listingMeta.transit_days_min,
          }
        : profileMeta.transit_days_min != null
          ? {
              min: profileMeta.transit_days_min,
              max: profileMeta.transit_days_max ?? profileMeta.transit_days_min,
            }
          : null

  const currency = input.currency ?? 'INR'
  let shippingCostLabel = 'Shipping calculated at checkout'

  if (profile?.fixed_fee != null && profile.fixed_fee <= 0) {
    shippingCostLabel = 'Free shipping'
  } else if (
    profile?.free_shipping_threshold != null &&
    input.price >= profile.free_shipping_threshold
  ) {
    shippingCostLabel = 'Free shipping'
  } else if (profile?.fixed_fee != null && profile.fixed_fee > 0) {
    shippingCostLabel = `${formatCurrency(profile.fixed_fee, currency)} shipping`
  } else if (profile?.shipping_rate_type === 'free') {
    shippingCostLabel = 'Free shipping'
  } else if (input.shopShipping?.rail === 'shedelivery' || input.shopShipping?.rail === 'own_account') {
    shippingCostLabel = input.shopShipping.providerLabel
      ? `Shipping via ${input.shopShipping.providerLabel}`
      : 'Seller ships'
  } else if (input.shopShipping?.providerLabel) {
    shippingCostLabel = `Shipping via ${input.shopShipping.providerLabel}`
  }

  const shipsFrom =
    listingMeta.ships_from ??
    profileMeta.ships_from ??
    input.shipsFromCity ??
    input.shopShipping?.shipsFrom ??
    undefined

  const providerLabel = input.shopShipping?.providerLabel ?? undefined
  const hasDeliveryEstimate = transit != null && (processingMin + transit.min) >= 0

  if (!hasDeliveryEstimate) {
    const fallbackLabel = providerLabel
      ? `Ships via ${providerLabel}`
      : shipsFrom
        ? `Ships from ${shipsFrom}`
        : 'Ships to you'

    return {
      kind: 'physical',
      processingLabel:
        processingMax > 0
          ? `Processing time: ${formatProcessingTime(processingMin, processingMax)}`
          : 'Processing time varies by shop',
      estimatedDeliveryLabel: fallbackLabel,
      shippingCostLabel,
      shipsFromLabel: shipsFrom ? `Ships from ${shipsFrom}` : undefined,
      returnsLabel: listingMeta.returns_policy ?? profileMeta.returns_policy,
      providerLabel,
      hasDeliveryEstimate: false,
    }
  }

  const today = new Date()
  const deliveryStart = addBusinessDays(today, processingMin + transit.min)
  const deliveryEnd = addBusinessDays(today, processingMax + transit.max)

  return {
    kind: 'physical',
    processingLabel: `Processing time: ${formatProcessingTime(processingMin, processingMax)}`,
    estimatedDeliveryLabel: `Estimated delivery ${formatDateRange(deliveryStart, deliveryEnd)}`,
    shippingCostLabel,
    shipsFromLabel: shipsFrom ? `Ships from ${shipsFrom}` : undefined,
    returnsLabel: listingMeta.returns_policy ?? profileMeta.returns_policy,
    providerLabel,
    hasDeliveryEstimate: true,
  }
}

export function getListingCardFulfillmentLabel(input: ListingFulfillmentInput): string | null {
  const info = buildListingFulfillmentInfo(input)
  if (!info) return null
  if (info.kind === 'digital') return 'Instant download'

  if (info.hasDeliveryEstimate) {
    const estimate = info.estimatedDeliveryLabel.replace('Estimated delivery ', 'Est. delivery ')
    if (info.providerLabel && info.providerLabel !== 'Seller ships') {
      return estimate
    }
    return estimate
  }

  if (info.providerLabel) return `Ships via ${info.providerLabel}`
  if (info.shipsFromLabel) return info.shipsFromLabel.replace('Ships from ', 'Ships from ')
  return 'Ships to you'
}

export function buildListingFulfillmentInputFromSummary(listing: {
  listing_type?: string | null
  price?: number | null
  currency?: string | null
  shipping_required?: boolean | null
  listing_metadata?: Json | unknown | null
  listing_delivery_profiles?: DeliveryProfile[] | null
  shop_shipping?: ShopShippingSummary | null
  shop_address?: { city?: string | null; state?: string | null } | null
}): ListingFulfillmentInput {
  return {
    listingType: listing.listing_type ?? 'physical',
    price: listing.price ?? 0,
    currency: listing.currency ?? undefined,
    shippingRequired: listing.shipping_required,
    listingMetadata: (listing.listing_metadata ?? null) as Json | null,
    listingDeliveryProfiles: listing.listing_delivery_profiles ?? undefined,
    shopShipping: listing.shop_shipping,
    shipsFromCity: listing.shop_address?.city ?? listing.shop_address?.state ?? null,
  }
}

export async function fetchListingTypesByIds(
  listingIds: string[],
): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map()

  const { supabase } = await import('~/lib/supabase/client')
  const { ACTIVE_LISTING_FILTER } = await import('~/commerce/lib/listing-visibility')
  const { data } = await supabase
    .from('listings')
    .select('id, listing_type')
    .in('id', listingIds)
    .eq('is_active', ACTIVE_LISTING_FILTER.is_active)
    .eq('listing_status', ACTIVE_LISTING_FILTER.listing_status)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.id, row.listing_type)
  }
  return map
}

export function cartRequiresShipping(listingTypes: Map<string, string>, listingIds: string[]) {
  return listingIds.some((id) => isPhysicalListing(listingTypes.get(id)))
}

/**
 * Available stock per listing, matching the `create_customer_order` RPC which
 * validates against `listings.quantity`. A `null` value means untracked/unlimited.
 */
export async function fetchListingStockByIds(
  listingIds: string[],
): Promise<Map<string, number | null>> {
  if (!listingIds.length) return new Map()

  const { supabase } = await import('~/lib/supabase/client')
  const { data } = await supabase.from('listings').select('id, quantity').in('id', listingIds)

  const map = new Map<string, number | null>()
  for (const row of data ?? []) {
    map.set(row.id, typeof row.quantity === 'number' ? row.quantity : null)
  }
  return map
}
