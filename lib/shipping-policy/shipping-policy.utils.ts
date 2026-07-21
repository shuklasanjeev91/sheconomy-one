import { formatCurrency } from '~/lib/format'
import { getAllGeoCountries, getCountryName, getDefaultCountryCode, resolveCountryCode } from '~/lib/geo'

import {
  DEFAULT_SHIPPING_POLICY_VALUES,
  SHIPPING_CALCULATOR_DEFAULTS,
  SHIPPING_POLICY_DISPLAY,
  SHIPPING_POLICY_VALIDATION,
  SHIPPING_RATE_TYPE,
  SHIPPING_ZONE_TYPE,
} from './shipping-policy.constants'
import type {
  AssignedShippingPolicy,
  ShippingChargeResult,
  ShippingPolicy,
  ShippingPolicyFormatted,
  ShippingPolicyInput,
  ShippingRate,
  ShippingZone,
} from './shipping-policy.type'
import { parseShippingZonesFromJson } from './shipping-policy.type'

// ============= DEFAULTS =============

export function getDefaultShippingPolicy(
  shopName?: string | null,
  shopCountry?: string | null,
): ShippingPolicyInput {
  const name = shopName?.trim() || SHIPPING_POLICY_DISPLAY.FALLBACK_SHOP_NAME
  const country = resolveCountryCode(shopCountry ?? getDefaultCountryCode())

  return {
    profile_name: `${name} Standard Delivery`,
    is_default: DEFAULT_SHIPPING_POLICY_VALUES.IS_DEFAULT,
    is_active: DEFAULT_SHIPPING_POLICY_VALUES.IS_ACTIVE,
    processing_time_min: DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MIN,
    processing_time_max: DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MAX,
    shipping_zones: [],
    free_shipping_threshold: DEFAULT_SHIPPING_POLICY_VALUES.FREE_SHIPPING_THRESHOLD,
    delivery_metadata: {},
    shipping_rate_type: DEFAULT_SHIPPING_POLICY_VALUES.SHIPPING_RATE_TYPE,
    fixed_fee: DEFAULT_SHIPPING_POLICY_VALUES.FIXED_FEE,
  }
}

export function getShopLevelShippingPolicyInput(
  shopCountry?: string | null,
): ShippingPolicyInput {
  const country = resolveCountryCode(shopCountry ?? getDefaultCountryCode())
  return {
    profile_name: SHIPPING_POLICY_DISPLAY.FALLBACK_PROFILE_NAME,
    is_default: true,
    is_active: true,
    processing_time_min: 1,
    processing_time_max: 3,
    shipping_rate_type: SHIPPING_RATE_TYPE.FIXED,
    fixed_fee: 0,
    free_shipping_threshold: null,
    shipping_zones: [
      {
        zone: SHIPPING_ZONE_TYPE.SHOP,
        zone_name: 'Shop Shipping',
        countries: [country],
        rates: [],
      },
    ],
    delivery_metadata: {},
  }
}

// ============= SORT / FILTER =============

export function sortShippingPolicies<T extends Pick<ShippingPolicy, 'is_default' | 'created_at'>>(
  policies: T[] | null | undefined,
): T[] {
  if (!Array.isArray(policies)) return []

  return [...policies].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function filterShippingPoliciesByQuery<T extends Pick<ShippingPolicy, 'profile_name'>>(
  policies: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return policies

  return policies.filter((policy) => policy.profile_name?.toLowerCase().includes(needle))
}

// ============= ZONE HELPERS =============

export function getCountriesByZoneType(
  zoneType: string,
  shopCountry?: string | null,
): Array<{ code: string; name: string }> {
  const domesticCode = resolveCountryCode(shopCountry ?? getDefaultCountryCode())

  if (zoneType === SHIPPING_ZONE_TYPE.DOMESTIC || zoneType === SHIPPING_ZONE_TYPE.SHOP) {
    return [{ code: domesticCode, name: getCountryName(domesticCode) }]
  }

  if (zoneType === SHIPPING_ZONE_TYPE.INTERNATIONAL) {
    return getAllGeoCountries()
      .filter((country) => country.isoCode.toUpperCase() !== domesticCode)
      .map((country) => ({ code: country.isoCode, name: country.name }))
  }

  return getAllGeoCountries().map((country) => ({ code: country.isoCode, name: country.name }))
}

export function normalizeShippingZones(raw: ShippingPolicy['shipping_zones']): ShippingZone[] {
  return parseShippingZonesFromJson(raw)
}

export function serializeShippingZones(zones: ShippingZone[]): ShippingZone[] {
  return zones.map((zone) => ({
    ...zone,
    countries: zone.countries.map((code) => resolveCountryCode(code)),
  }))
}

export function getApplicableRate(
  zone: ShippingZone,
  orderValue: number,
  weight?: number | null,
): ShippingRate | null {
  const rates = zone.rates ?? []
  if (rates.length === 0) return null

  const applicable = rates.filter((rate) => {
    if (orderValue < rate.min_order) return false
    if (rate.max_order != null && orderValue > rate.max_order) return false
    if (weight != null && rate.max_weight != null && weight > rate.max_weight) return false
    return true
  })

  if (applicable.length === 0) return null
  return applicable.reduce((best, current) => (current.min_order > best.min_order ? current : best))
}

export function calculateShippingForZone(
  zones: ShippingZone[],
  countryCode: string,
  orderValue: number,
  weight?: number | null,
): { zone: ShippingZone | null; rate: ShippingRate | null; cost: number | null; error?: string } {
  const destination = resolveCountryCode(countryCode)
  const zone = zones.find((row) => row.countries?.map(resolveCountryCode).includes(destination))

  if (!zone) {
    return { zone: null, rate: null, cost: null, error: 'Shipping not available to this country.' }
  }

  const rate = getApplicableRate(zone, orderValue, weight)
  if (!rate) {
    return { zone, rate: null, cost: null, error: 'No shipping rate available for this order.' }
  }

  return { zone, rate, cost: rate.fee, error: undefined }
}

// ============= CHECKOUT CALCULATOR (ported from shipping-calculator.js) =============

export function resolveActiveShippingPolicy(
  policies: ShippingPolicy[] | null | undefined,
): ShippingPolicy | null {
  if (!policies?.length) return null
  return (
    policies.find((row) => row.is_active && row.is_default) ??
    policies.find((row) => row.is_active) ??
    policies[0] ??
    null
  )
}

export function calculateShippingCharge(
  deliveryProfiles: ShippingPolicy[] | null | undefined,
  orderSubtotal: number,
): ShippingChargeResult {
  const activeProfile = resolveActiveShippingPolicy(deliveryProfiles)

  if (!activeProfile) {
    return {
      shippingAmount: SHIPPING_CALCULATOR_DEFAULTS.ZERO_AMOUNT,
      deliveryProfile: null,
      estimatedDays: SHIPPING_CALCULATOR_DEFAULTS.ESTIMATED_DAYS,
      isFreeShipping: true,
    }
  }

  const subtotal = Number(orderSubtotal) || 0
  const estimatedDays = activeProfile.processing_time_max || SHIPPING_CALCULATOR_DEFAULTS.ESTIMATED_DAYS

  if (activeProfile.shipping_rate_type === SHIPPING_RATE_TYPE.FREE) {
    return {
      shippingAmount: 0,
      deliveryProfile: activeProfile,
      estimatedDays,
      isFreeShipping: true,
      freeShippingThreshold: activeProfile.free_shipping_threshold,
    }
  }

  if (
    activeProfile.shipping_rate_type !== SHIPPING_RATE_TYPE.VARIABLE &&
    activeProfile.free_shipping_threshold != null &&
    subtotal >= activeProfile.free_shipping_threshold
  ) {
    return {
      shippingAmount: 0,
      deliveryProfile: activeProfile,
      estimatedDays,
      isFreeShipping: true,
      freeShippingThreshold: activeProfile.free_shipping_threshold,
    }
  }

  let shippingAmount = 0

  if (activeProfile.shipping_rate_type === SHIPPING_RATE_TYPE.FIXED) {
    shippingAmount = Number(activeProfile.fixed_fee) || 0
  } else if (activeProfile.shipping_rate_type === SHIPPING_RATE_TYPE.VARIABLE) {
    const zones = normalizeShippingZones(activeProfile.shipping_zones)
    const zone = zones[0]
    if (zone?.rates?.length) {
      const applicableRate = zone.rates.find((rate) => {
        const minOrder = Number(rate.min_order) || 0
        const maxOrder = rate.max_order == null ? Infinity : Number(rate.max_order)
        return subtotal >= minOrder && subtotal <= maxOrder
      })
      shippingAmount = applicableRate ? Number(applicableRate.fee) || 0 : Number(activeProfile.fixed_fee) || 0
    } else {
      shippingAmount = Number(activeProfile.fixed_fee) || 0
    }
  }

  return {
    shippingAmount,
    deliveryProfile: activeProfile,
    estimatedDays,
    isFreeShipping: shippingAmount === 0,
    freeShippingThreshold: activeProfile.free_shipping_threshold,
  }
}

export function calculateEstimatedDeliveryDate(processingDays = SHIPPING_CALCULATOR_DEFAULTS.ESTIMATED_DAYS): Date {
  const deliveryDate = new Date()
  deliveryDate.setDate(deliveryDate.getDate() + processingDays)
  return deliveryDate
}

// ============= FORMAT =============

export function formatShippingPolicy(
  policy: ShippingPolicy | null | undefined,
  currencyCode?: string | null,
): ShippingPolicyFormatted | null {
  if (!policy) return null

  const zones = normalizeShippingZones(policy.shipping_zones)
  const currency = currencyCode ?? 'INR'

  return {
    ...policy,
    shipping_zones: zones,
    processing_time_display: `${policy.processing_time_min}-${policy.processing_time_max} ${SHIPPING_POLICY_DISPLAY.PROCESSING_SUFFIX}`,
    free_shipping_display: policy.free_shipping_threshold
      ? `${SHIPPING_POLICY_DISPLAY.FREE_SHIPPING_PREFIX} ${formatCurrency(policy.free_shipping_threshold, currency)}`
      : SHIPPING_POLICY_DISPLAY.NO_FREE_SHIPPING,
    zones_count: zones.length,
    is_default_display: policy.is_default
      ? SHIPPING_POLICY_DISPLAY.DEFAULT_LABEL
      : SHIPPING_POLICY_DISPLAY.CUSTOM_LABEL,
    rate_type_display: policy.shipping_rate_type ?? SHIPPING_RATE_TYPE.FIXED,
  }
}

export function formatShippingPolicies(
  policies: ShippingPolicy[] | null | undefined,
  currencyCode?: string | null,
): ShippingPolicyFormatted[] {
  return sortShippingPolicies(policies ?? [])
    .map((policy) => formatShippingPolicy(policy, currencyCode))
    .filter((row): row is ShippingPolicyFormatted => row !== null)
}

export function formatShippingZone(zone: ShippingZone | null | undefined) {
  if (!zone) return null

  const countriesDisplay =
    zone.countries?.map((code) => getCountryName(code)).join(', ') ?? ''

  return {
    ...zone,
    display_name:
      zone.zone_name ||
      `${String(zone.zone).charAt(0).toUpperCase()}${String(zone.zone).slice(1)} Zone`,
    countries_display: countriesDisplay,
    rates_count: zone.rates?.length ?? 0,
    has_rates: Boolean(zone.rates?.length),
  }
}

// ============= STATE HELPERS =============

export function applyDefaultShippingPolicyChange(
  policies: ShippingPolicy[],
  policyId: string,
  isDefault: boolean,
): ShippingPolicy[] {
  if (!isDefault) {
    return policies.map((policy) =>
      policy.id === policyId ? { ...policy, is_default: false } : policy,
    )
  }

  const target = policies.find((policy) => policy.id === policyId)
  if (!target) return policies

  return policies.map((policy) => {
    if (policy.id === policyId) return { ...policy, is_default: true }
    if (policy.shop_id === target.shop_id && policy.is_default) {
      return { ...policy, is_default: false }
    }
    return policy
  })
}

export function upsertShippingPolicy(policies: ShippingPolicy[], policy: ShippingPolicy): ShippingPolicy[] {
  const next = policies.some((row) => row.id === policy.id)
    ? policies.map((row) => (row.id === policy.id ? policy : row))
    : [...policies, policy]

  return sortShippingPolicies(
    policy.is_default ? applyDefaultShippingPolicyChange(next, policy.id, true) : next,
  )
}

export function removeShippingPolicyById(policies: ShippingPolicy[], policyId: string): ShippingPolicy[] {
  return policies.filter((policy) => policy.id !== policyId)
}

export function upsertListingShippingAssignment(
  assignments: AssignedShippingPolicy[],
  policy: AssignedShippingPolicy,
): AssignedShippingPolicy[] {
  if (assignments.some((row) => row.id === policy.id)) return assignments
  return [...assignments, policy]
}

export function removeListingShippingAssignment(
  assignments: AssignedShippingPolicy[],
  deliveryProfileId: string,
): AssignedShippingPolicy[] {
  return assignments.filter((row) => row.id !== deliveryProfileId)
}

export function shouldUseShippingPolicyCache(
  lastFetch: number | null | undefined,
  forceRefresh?: boolean,
): boolean {
  if (forceRefresh) return false
  if (!lastFetch) return false
  return Date.now() - lastFetch < SHIPPING_POLICY_VALIDATION.CACHE_TTL_MS
}

export function buildOptimisticShippingPolicy(
  requestId: string,
  shopId: string,
  input: ShippingPolicyInput,
): ShippingPolicy {
  const now = new Date().toISOString()
  const zones = serializeShippingZones(input.shipping_zones ?? [])

  return {
    id: `temp-${requestId}`,
    shop_id: shopId,
    profile_name: input.profile_name.trim(),
    is_default: input.is_default ?? false,
    is_active: input.is_active ?? true,
    processing_time_min: input.processing_time_min ?? DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MIN,
    processing_time_max: input.processing_time_max ?? DEFAULT_SHIPPING_POLICY_VALUES.PROCESSING_TIME_MAX,
    shipping_zones: zones,
    free_shipping_threshold: input.free_shipping_threshold ?? null,
    delivery_metadata: (input.delivery_metadata ?? {}) as ShippingPolicy['delivery_metadata'],
    shipping_rate_type: input.shipping_rate_type ?? DEFAULT_SHIPPING_POLICY_VALUES.SHIPPING_RATE_TYPE,
    fixed_fee: input.fixed_fee ?? DEFAULT_SHIPPING_POLICY_VALUES.FIXED_FEE,
    created_at: now,
    updated_at: now,
  }
}

export function buildOptimisticListingShippingAssignment(
  policy: ShippingPolicy,
  assignedAt?: string,
): AssignedShippingPolicy {
  return {
    ...policy,
    assigned_at: assignedAt ?? new Date().toISOString(),
  }
}

export function inferFreeShippingThresholdFromZones(
  shippingRateType: string | null | undefined,
  zones: ShippingZone[],
  explicitThreshold?: number | null,
): number | null {
  if (shippingRateType === SHIPPING_RATE_TYPE.FIXED) return explicitThreshold ?? null

  for (const zone of zones) {
    const freeRate = zone.rates?.find((rate) => rate.fee === 0)
    if (freeRate) return freeRate.min_order
  }

  return explicitThreshold ?? null
}
