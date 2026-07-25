import { formatCurrency } from '~/lib/format'
import { getDefaultCountryCode, resolveCountryCode } from '~/lib/geo'

import {
  SHIPPING_POLICY_DISPLAY,
  SHIPPING_PROCESSING_PRESETS,
  SHIPPING_RATE_TYPE,
  SHIPPING_ZONE_TYPE,
} from '~/lib/shipping-policy/shipping-policy.constants'
import type {
  ShippingPolicy,
  ShippingPolicyFormData,
  ShippingPolicyInput,
  ShippingRate,
  ShippingZone,
} from '~/lib/shipping-policy/shipping-policy.type'
import { parseShippingZonesFromJson } from '~/lib/shipping-policy/shipping-policy.type'
import {
  getShopLevelShippingPolicyInput,
  inferFreeShippingThresholdFromZones,
  normalizeShippingZones,
} from '~/lib/shipping-policy/shipping-policy.utils'

export function createShippingPolicyFormData(
  _shopName?: string | null,
  shopCountry?: string | null,
): ShippingPolicyFormData {
  const input = getShopLevelShippingPolicyInput(shopCountry)
  return {
    profile_name: input.profile_name ?? SHIPPING_POLICY_DISPLAY.FALLBACK_PROFILE_NAME,
    is_default: input.is_default ?? true,
    is_active: input.is_active ?? true,
    processing_time_min: input.processing_time_min ?? 1,
    processing_time_max: input.processing_time_max ?? 3,
    shipping_rate_type: input.shipping_rate_type ?? SHIPPING_RATE_TYPE.FIXED,
    fixed_fee: input.fixed_fee ?? 0,
    free_shipping_threshold: input.free_shipping_threshold ?? null,
    shipping_zones: input.shipping_zones ?? [],
    delivery_metadata: (input.delivery_metadata as Record<string, unknown>) ?? {},
  }
}

export function shippingPolicyToFormData(policy: ShippingPolicy): ShippingPolicyFormData {
  const zones = normalizeShippingZones(policy.shipping_zones)
  const rates = zones[0]?.rates ?? []
  let shippingRateType = (policy.shipping_rate_type as ShippingPolicyFormData['shipping_rate_type']) ?? SHIPPING_RATE_TYPE.FIXED
  let fixedFee = policy.fixed_fee ?? 0

  if (!policy.shipping_rate_type && rates.length > 0) {
    const hasFreeThreshold = rates.some((r) => r.fee === 0 && r.min_order > 0)
    const allSameFee = rates.every((r) => r.fee === rates[0]?.fee && r.fee > 0)
    if (hasFreeThreshold || !allSameFee || rates.length > 1) {
      shippingRateType = SHIPPING_RATE_TYPE.VARIABLE
    } else {
      shippingRateType = SHIPPING_RATE_TYPE.FIXED
      fixedFee = rates[0]?.fee ?? 0
    }
  }

  return {
    profile_name: policy.profile_name,
    is_default: policy.is_default,
    is_active: policy.is_active,
    processing_time_min: policy.processing_time_min,
    processing_time_max: policy.processing_time_max,
    shipping_rate_type: shippingRateType,
    fixed_fee: fixedFee,
    free_shipping_threshold: policy.free_shipping_threshold,
    shipping_zones: zones,
    delivery_metadata:
      policy.delivery_metadata && typeof policy.delivery_metadata === 'object' && !Array.isArray(policy.delivery_metadata)
        ? (policy.delivery_metadata as Record<string, unknown>)
        : {},
  }
}

export function formDataToShippingPolicyInput(form: ShippingPolicyFormData): ShippingPolicyInput {
  const freeShippingThreshold = inferFreeShippingThresholdFromZones(
    form.shipping_rate_type,
    form.shipping_zones,
    form.free_shipping_threshold,
  )

  return {
    profile_name: form.profile_name.trim() || SHIPPING_POLICY_DISPLAY.FALLBACK_PROFILE_NAME,
    is_default: form.is_default,
    is_active: form.is_active,
    processing_time_min: form.processing_time_min,
    processing_time_max: form.processing_time_max,
    shipping_zones: form.shipping_zones,
    free_shipping_threshold: freeShippingThreshold,
    delivery_metadata: form.delivery_metadata,
    shipping_rate_type: form.shipping_rate_type,
    fixed_fee: form.fixed_fee,
  }
}

export function getProcessingPresetValue(min: number, max: number): string {
  const match = SHIPPING_PROCESSING_PRESETS.find((row) => row.min === min && row.max === max)
  return match?.value ?? SHIPPING_PROCESSING_PRESETS[0].value
}

export function applyProcessingPreset(
  value: string,
): Pick<ShippingPolicyFormData, 'processing_time_min' | 'processing_time_max'> {
  const preset = SHIPPING_PROCESSING_PRESETS.find((row) => row.value === value)
  return {
    processing_time_min: preset?.min ?? SHIPPING_PROCESSING_PRESETS[0].min,
    processing_time_max: preset?.max ?? SHIPPING_PROCESSING_PRESETS[0].max,
  }
}

export function buildShopShippingZone(shopCountry?: string | null, rates: ShippingRate[] = []): ShippingZone {
  return {
    zone: SHIPPING_ZONE_TYPE.SHOP,
    zone_name: 'Shop Shipping',
    countries: [resolveCountryCode(shopCountry ?? getDefaultCountryCode())],
    rates,
  }
}

export function buildFixedRatesFromFeeAndThreshold(
  fee: number,
  threshold: number | null | undefined,
): ShippingRate[] {
  const rates: ShippingRate[] = [
    {
      fee,
      min_order: 0,
      max_order: threshold ? threshold - 0.01 : null,
    },
  ]
  if (threshold != null && threshold > 0) {
    rates.push({ fee: 0, min_order: threshold, max_order: null })
  }
  return rates
}

export function applyFixedFeeToForm(
  form: ShippingPolicyFormData,
  fee: number,
  shopCountry?: string | null,
): Pick<ShippingPolicyFormData, 'fixed_fee' | 'shipping_zones'> {
  return {
    fixed_fee: fee,
    shipping_zones: [
      buildShopShippingZone(shopCountry, buildFixedRatesFromFeeAndThreshold(fee, form.free_shipping_threshold)),
    ],
  }
}

export function applyFreeThresholdToForm(
  form: ShippingPolicyFormData,
  threshold: number | null,
  shopCountry?: string | null,
): Pick<ShippingPolicyFormData, 'free_shipping_threshold' | 'shipping_zones'> {
  return {
    free_shipping_threshold: threshold,
    shipping_zones: [
      buildShopShippingZone(
        shopCountry,
        buildFixedRatesFromFeeAndThreshold(form.fixed_fee ?? 0, threshold),
      ),
    ],
  }
}

export function applyRateTypeToForm(
  rateType: ShippingPolicyFormData['shipping_rate_type'],
  form: ShippingPolicyFormData,
  shopCountry?: string | null,
): Pick<ShippingPolicyFormData, 'shipping_rate_type' | 'shipping_zones'> {
  if (rateType === SHIPPING_RATE_TYPE.FIXED) {
    return {
      shipping_rate_type: rateType,
      shipping_zones: [
        buildShopShippingZone(
          shopCountry,
          form.fixed_fee
            ? buildFixedRatesFromFeeAndThreshold(form.fixed_fee, form.free_shipping_threshold)
            : [],
        ),
      ],
    }
  }

  const existing = form.shipping_zones.length > 0 ? form.shipping_zones : [buildShopShippingZone(shopCountry, [])]
  return { shipping_rate_type: rateType, shipping_zones: existing }
}

export type RateDisplayInfo = {
  display: string
  tooltip: string
}

export function getShippingRateDisplayInfo(
  policy: ShippingPolicy,
  currencyCode: string,
): RateDisplayInfo {
  if (policy.shipping_rate_type === SHIPPING_RATE_TYPE.FIXED) {
    const fee = policy.fixed_fee ?? 0
    return {
      display: `${formatCurrency(fee, currencyCode)} flat for all orders`,
      tooltip: `Flat ${formatCurrency(fee, currencyCode)} shipping for all order values.`,
    }
  }

  const zones = parseShippingZonesFromJson(policy.shipping_zones)
  const rates = zones[0]?.rates ?? []
  if (!rates.length) {
    return {
      display: 'No rates configured',
      tooltip: 'Add shipping rates in the edit drawer.',
    }
  }

  const sorted = [...rates].sort((a, b) => (a.min_order ?? 0) - (b.min_order ?? 0))
  const displayPieces = sorted.map((rate) => formatRateRangeLabel(rate, currencyCode))
  const tooltipLines = sorted.map((rate) => {
    const range = formatRateRangeText(rate, currencyCode)
    return rate.fee === 0 ? `✓ ${range}: FREE` : `💰 ${range}: ${formatCurrency(rate.fee, currencyCode)}`
  })

  return {
    display: displayPieces.join(', '),
    tooltip: tooltipLines.join('\n'),
  }
}

function formatRateRangeText(rate: ShippingRate, currencyCode: string): string {
  const min = rate.min_order ?? 0
  const max = rate.max_order
  if (max == null) return `orders ≥ ${formatCurrency(min, currencyCode)}`
  return `orders ${formatCurrency(min, currencyCode)}–${formatCurrency(max, currencyCode)}`
}

function formatRateRangeLabel(rate: ShippingRate, currencyCode: string): string {
  const min = rate.min_order ?? 0
  const max = rate.max_order
  const range =
    max == null
      ? `≥ ${formatCurrency(min, currencyCode)}`
      : `${formatCurrency(min, currencyCode)}–${formatCurrency(max, currencyCode)}`
  if (rate.fee === 0) return `${range}: Free`
  return `${range}: ${formatCurrency(rate.fee, currencyCode)}`
}

export function sortRates(rates: ShippingRate[]): ShippingRate[] {
  return [...rates].sort((a, b) => (a.min_order ?? 0) - (b.min_order ?? 0))
}

export function validateRateTierOverlap(rates: ShippingRate[]): string | null {
  if (rates.length < 2) return null
  const sorted = sortRates(rates)
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i]
    const next = sorted[i + 1]
    if (current.max_order != null && next.min_order <= current.max_order) {
      return 'Rate ranges overlap. Adjust min/max order values.'
    }
  }
  return null
}
