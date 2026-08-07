import type { Json } from '~/lib/supabase'

import type { DeliveryProfile } from '~/commerce/lib/listing-fulfillment'

export type ShopShippingProvider = {
  id: string
  provider_name: string
  provider_type: string
  is_primary?: boolean | null
  is_active?: boolean | null
  configuration?: Json | null
}

export type ShopShippingRate = {
  delivery_days_min: number | null
  delivery_days_max: number | null
  zone_name: string
  is_active?: boolean | null
  shipping_provider_id?: string | null
}

export type ShopShippingAccount = {
  provider: string
  status?: string | null
}

export type ShippingRail = 'shedelivery' | 'own_account' | 'manual' | 'unknown'

export type ShopShippingSummary = {
  rail: ShippingRail
  providerLabel: string | null
  deliveryProfiles: DeliveryProfile[]
  shippingProviders: ShopShippingProvider[]
  shippingRates: ShopShippingRate[]
  connectedAccounts: ShopShippingAccount[]
  shipsFrom?: string | null
  defaultTransitDays?: { min: number; max: number } | null
}

type ShopMetadata = {
  shipping_rail?: string
  fulfillment_mode?: string
  default_transit_days_min?: number
  default_transit_days_max?: number
}

type ProviderConfiguration = {
  transit_days_min?: number
  transit_days_max?: number
  default_delivery_days_min?: number
  default_delivery_days_max?: number
}

const SHEDELIVERY_TYPES = new Set([
  'shedelivery',
  'she_delivery',
  'she-delivery',
  'platform',
  'sheconomy',
])

const OWN_ACCOUNT_TYPES = new Set([
  'shiprocket',
  'pickrr',
  'own',
  'own_account',
  'custom',
  'third_party',
  'partner',
])

const CONNECTED_ACCOUNT_STATUSES = new Set(['connected', 'pending'])

function parseObject<T extends Record<string, unknown>>(value: Json | null | undefined): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as T
  return value as T
}

function normalizeProviderType(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''
}

function formatProviderLabel(provider: ShopShippingProvider) {
  const type = normalizeProviderType(provider.provider_type)
  const name = provider.provider_name?.trim()

  if (type && SHEDELIVERY_TYPES.has(type)) return 'Seller ships'
  if (type === 'shiprocket' || name?.toLowerCase().includes('shiprocket')) return 'Shiprocket'
  if (type === 'pickrr' || name?.toLowerCase().includes('pickrr')) return 'Pickrr'
  if (name) return name
  if (type) return type.replace(/_/g, ' ')
  return null
}

function isActiveProvider(provider: ShopShippingProvider) {
  return provider.is_active !== false
}

function pickPrimaryProvider(providers: ShopShippingProvider[]) {
  const active = providers.filter(isActiveProvider)
  return active.find((provider) => provider.is_primary) ?? active[0] ?? null
}

function summarizeShippingRates(rates: ShopShippingRate[]) {
  const active = rates.filter(
    (rate) =>
      rate.is_active !== false &&
      rate.delivery_days_min != null &&
      rate.delivery_days_min >= 0,
  )

  if (!active.length) return null

  const min = Math.min(...active.map((rate) => rate.delivery_days_min ?? 0))
  const max = Math.max(
    ...active.map((rate) => rate.delivery_days_max ?? rate.delivery_days_min ?? 0),
  )

  return { min, max }
}

function readProviderTransit(provider: ShopShippingProvider | null) {
  if (!provider) return null
  const config = parseObject<ProviderConfiguration>(provider.configuration)
  const min =
    config.transit_days_min ??
    config.default_delivery_days_min ??
    null
  const max =
    config.transit_days_max ??
    config.default_delivery_days_max ??
    min

  if (min == null) return null
  return { min, max: max ?? min }
}

export function mapJoinedDeliveryProfiles(
  rows?: Array<{ delivery_profiles: DeliveryProfile | null }> | null,
): DeliveryProfile[] {
  return (rows ?? [])
    .map((row) => row.delivery_profiles)
    .filter((profile): profile is DeliveryProfile => profile != null && profile.is_active !== false)
}

export function buildShopShippingSummary(input: {
  shop_metadata?: Json | null
  delivery_profiles?: DeliveryProfile[] | null
  shipping_providers?: ShopShippingProvider[] | null
  shop_shipping_accounts?: ShopShippingAccount[] | null
  shipping_rates?: ShopShippingRate[] | null
  shop_addresses?: {
    city?: string | null
    state?: string | null
    country?: string | null
  } | null
}): ShopShippingSummary {
  const metadata = parseObject<ShopMetadata>(input.shop_metadata)
  const deliveryProfiles = (input.delivery_profiles ?? []).filter(
    (profile) => profile.is_active !== false,
  )
  const providers = (input.shipping_providers ?? []).filter(isActiveProvider)
  const connectedAccounts = (input.shop_shipping_accounts ?? []).filter((account) =>
    CONNECTED_ACCOUNT_STATUSES.has(account.status ?? ''),
  )
  const shippingRates = (input.shipping_rates ?? []).filter((rate) => rate.is_active !== false)
  const address = Array.isArray(input.shop_addresses)
    ? input.shop_addresses[0]
    : input.shop_addresses

  const shipsFrom =
    address?.city?.trim() ||
    address?.state?.trim() ||
    address?.country?.trim() ||
    null

  const metadataRail = normalizeProviderType(metadata.shipping_rail ?? metadata.fulfillment_mode)
  const primaryProvider = pickPrimaryProvider(providers)
  const primaryType = normalizeProviderType(primaryProvider?.provider_type)

  let rail: ShippingRail = 'unknown'
  let providerLabel: string | null = null

  if (metadataRail && SHEDELIVERY_TYPES.has(metadataRail)) {
    // Legacy shedelivery rail → vendor self-ship.
    rail = 'own_account'
    providerLabel = 'Seller ships'
  } else if (metadataRail && OWN_ACCOUNT_TYPES.has(metadataRail)) {
    rail = 'own_account'
    providerLabel = formatProviderLabel({
      id: 'metadata',
      provider_name: metadataRail,
      provider_type: metadataRail,
    })
  } else if (connectedAccounts.length > 0) {
    rail = 'own_account'
    const account = connectedAccounts[0]
    providerLabel =
      account.provider === 'shiprocket'
        ? 'Shiprocket'
        : account.provider === 'pickrr'
          ? 'Pickrr'
          : account.provider
  } else if (primaryProvider) {
    if (SHEDELIVERY_TYPES.has(primaryType)) {
      rail = 'own_account'
      providerLabel = 'Seller ships'
    } else if (OWN_ACCOUNT_TYPES.has(primaryType)) {
      rail = 'own_account'
      providerLabel = formatProviderLabel(primaryProvider)
    } else {
      rail = 'manual'
      providerLabel = formatProviderLabel(primaryProvider)
    }
  } else if (deliveryProfiles.length > 0) {
    rail = 'manual'
    providerLabel = null
  }

  const defaultTransitDays =
    metadata.default_transit_days_min != null
      ? {
          min: metadata.default_transit_days_min,
          max: metadata.default_transit_days_max ?? metadata.default_transit_days_min,
        }
      : null

  return {
    rail,
    providerLabel,
    deliveryProfiles,
    shippingProviders: providers,
    shippingRates,
    connectedAccounts,
    shipsFrom,
    defaultTransitDays,
  }
}

export function resolveTransitDaysForShop(
  summary: ShopShippingSummary,
  profile?: DeliveryProfile | null,
  metadata?: {
    transit_days_min?: number
    transit_days_max?: number
    default_transit_days_min?: number
    default_transit_days_max?: number
  },
) {
  const profileMeta = parseObject<{
    transit_days_min?: number
    transit_days_max?: number
  }>(profile?.delivery_metadata as Json)

  if (metadata?.transit_days_min != null) {
    return {
      min: metadata.transit_days_min,
      max: metadata.transit_days_max ?? metadata.transit_days_min,
    }
  }

  if (summary.defaultTransitDays) {
    return summary.defaultTransitDays
  }

  if (profileMeta.transit_days_min != null) {
    return {
      min: profileMeta.transit_days_min,
      max: profileMeta.transit_days_max ?? profileMeta.transit_days_min,
    }
  }

  const rateSummary = summarizeShippingRates(summary.shippingRates)
  if (rateSummary) return rateSummary

  const primaryProvider = pickPrimaryProvider(summary.shippingProviders)
  const providerTransit = readProviderTransit(primaryProvider)
  if (providerTransit) return providerTransit

  if (summary.rail === 'shedelivery') {
    return { min: 3, max: 7 }
  }

  if (summary.rail === 'own_account') {
    return { min: 4, max: 9 }
  }

  return null
}

export function getShopCardDeliveryHint(summary: ShopShippingSummary | null | undefined) {
  if (!summary) return null
  if (summary.rail === 'shedelivery') return 'Seller ships'
  if (summary.providerLabel) return `Ships via ${summary.providerLabel}`
  if (summary.shipsFrom) return `Ships from ${summary.shipsFrom}`
  return null
}
