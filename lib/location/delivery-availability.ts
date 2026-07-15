import type { Json } from '~/lib/supabase'
import { supabase } from '~/lib/supabase/client'
import { resolveCountryCode } from '~/lib/geo'

import type { DeliveryAvailabilityResult } from './types'

type ShippingZoneLike = {
  countries?: string[] | string | null
  country?: string | null
  states?: string[] | string | null
  pincodes?: string[] | string | null
  postal_codes?: string[] | string | null
  name?: string | null
}

function asStringList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

function parseZones(zones: Json | null | undefined): ShippingZoneLike[] {
  if (!zones) return []
  if (Array.isArray(zones)) return zones as ShippingZoneLike[]
  if (typeof zones === 'object') {
    const obj = zones as { zones?: ShippingZoneLike[]; shipping_zones?: ShippingZoneLike[] }
    if (Array.isArray(obj.zones)) return obj.zones
    if (Array.isArray(obj.shipping_zones)) return obj.shipping_zones
    return [zones as ShippingZoneLike]
  }
  return []
}

function normalizePostal(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function zoneMatches(
  zone: ShippingZoneLike,
  postalCode: string,
  country: string,
  state?: string | null,
): boolean {
  const countries = asStringList(zone.countries ?? zone.country).map((c) =>
    resolveCountryCode(c).toUpperCase(),
  )
  const countryCode = resolveCountryCode(country).toUpperCase()
  if (countries.length && !countries.includes(countryCode)) return false

  const pincodes = asStringList(zone.pincodes ?? zone.postal_codes).map(normalizePostal)
  if (pincodes.length) {
    return pincodes.includes(normalizePostal(postalCode))
  }

  const states = asStringList(zone.states).map((s) => s.toLowerCase())
  if (states.length && state) {
    return states.includes(state.trim().toLowerCase())
  }

  // Country-only zone with no pin/state list → whole country
  return countries.length > 0 || (!pincodes.length && !states.length && !countries.length)
}

function etaFromProfile(profile: {
  processing_time_min: number
  processing_time_max: number
  delivery_metadata: Json
}): string | null {
  const meta =
    profile.delivery_metadata &&
    typeof profile.delivery_metadata === 'object' &&
    !Array.isArray(profile.delivery_metadata)
      ? (profile.delivery_metadata as {
          transit_days_min?: number
          transit_days_max?: number
        })
      : {}
  const min = (profile.processing_time_min ?? 0) + (meta.transit_days_min ?? 2)
  const max = (profile.processing_time_max ?? 0) + (meta.transit_days_max ?? 7)
  if (min <= 0 && max <= 0) return null
  return min === max ? `Usually ${min} days` : `Usually ${min}–${max} days`
}

export type CheckDeliveryAvailabilityInput = {
  postalCode: string
  country: string
  state?: string | null
  shopId?: string | null
  listingId?: string | null
  /** Digital listings skip PIN checks. */
  listingType?: string | null
}

/**
 * Check if a postal code is serviceable for a shop/listing via delivery_profiles /
 * shipping_rates. Empty zone config => available (open shipping).
 */
export async function checkDeliveryAvailability(
  input: CheckDeliveryAvailabilityInput,
): Promise<DeliveryAvailabilityResult> {
  const postal = normalizePostal(input.postalCode)
  const country = resolveCountryCode(input.country)

  if (!postal || postal.length < 3) {
    return {
      available: false,
      reason: 'Enter a valid postal / PIN code.',
      etaHint: null,
      profileName: null,
    }
  }

  if (input.listingType === 'digital') {
    return {
      available: true,
      reason: null,
      etaHint: 'Instant digital delivery',
      profileName: null,
    }
  }

  let shopId = input.shopId ?? null

  if (!shopId && input.listingId) {
    const { data: listing } = await supabase
      .from('listings')
      .select('shop_id, listing_type')
      .eq('id', input.listingId)
      .maybeSingle()
    shopId = listing?.shop_id ?? null
    if (listing?.listing_type === 'digital') {
      return {
        available: true,
        reason: null,
        etaHint: 'Instant digital delivery',
        profileName: null,
      }
    }
  }

  if (!shopId) {
    return {
      available: true,
      reason: null,
      etaHint: null,
      profileName: null,
    }
  }

  const [{ data: profiles }, { data: rates }] = await Promise.all([
    supabase
      .from('delivery_profiles')
      .select(
        'id, profile_name, is_active, is_default, shipping_zones, processing_time_min, processing_time_max, delivery_metadata',
      )
      .eq('shop_id', shopId)
      .eq('is_active', true),
    supabase
      .from('shipping_rates')
      .select('zone_name, pincodes, states, is_active, delivery_days_min, delivery_days_max')
      .eq('shop_id', shopId)
      .eq('is_active', true),
  ])

  const activeProfiles = profiles ?? []
  const activeRates = rates ?? []

  // No configured zones → seller ships broadly
  if (!activeProfiles.length && !activeRates.length) {
    return {
      available: true,
      reason: null,
      etaHint: null,
      profileName: null,
    }
  }

  for (const profile of activeProfiles) {
    const zones = parseZones(profile.shipping_zones)
    if (!zones.length) {
      return {
        available: true,
        reason: null,
        etaHint: etaFromProfile(profile),
        profileName: profile.profile_name,
      }
    }
    if (zones.some((zone) => zoneMatches(zone, postal, country, input.state))) {
      return {
        available: true,
        reason: null,
        etaHint: etaFromProfile(profile),
        profileName: profile.profile_name,
      }
    }
  }

  for (const rate of activeRates) {
    const pinList = asStringList(rate.pincodes).map(normalizePostal)
    const stateList = asStringList(rate.states).map((s) => s.toLowerCase())
    const pinOk = !pinList.length || pinList.includes(postal)
    const stateOk =
      !stateList.length ||
      (input.state ? stateList.includes(input.state.trim().toLowerCase()) : false)
    if (pinOk && (stateOk || !stateList.length)) {
      const min = rate.delivery_days_min
      const max = rate.delivery_days_max
      const etaHint =
        min != null && max != null
          ? min === max
            ? `Usually ${min} days`
            : `Usually ${min}–${max} days`
          : null
      return {
        available: true,
        reason: null,
        etaHint,
        profileName: rate.zone_name,
      }
    }
  }

  // Profiles exist with zone lists but none matched
  const hasRestrictiveZones = activeProfiles.some(
    (profile) => parseZones(profile.shipping_zones).length > 0,
  )
  const hasRestrictiveRates = activeRates.some(
    (rate) => asStringList(rate.pincodes).length > 0 || asStringList(rate.states).length > 0,
  )

  if (hasRestrictiveZones || hasRestrictiveRates) {
    return {
      available: false,
      reason: 'This seller does not deliver to that PIN / postal code yet.',
      etaHint: null,
      profileName: null,
    }
  }

  return {
    available: true,
    reason: null,
    etaHint: null,
    profileName: activeProfiles[0]?.profile_name ?? null,
  }
}
