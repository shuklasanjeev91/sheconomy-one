import { formatCurrency } from '~/lib/format'

import type { DeliveryProfile, ListingFulfillmentInfo } from '~/commerce/lib/listing-fulfillment'
import type { ListingReturnPolicy } from '~/commerce/lib/return-policies'

export type ShopPolicySection = {
  title: string
  points: string[]
  details?: string | null
}

export type ListingShopPoliciesModel = {
  shipping: ShopPolicySection | null
  returns: ShopPolicySection | null
}

function parseReturnsPolicyNote(metadata: DeliveryProfile['delivery_metadata'] | null | undefined) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as { returns_policy?: unknown }).returns_policy
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Build marketplace/marketplace shipping + return/refund policy sections for a listing. */
export function buildListingShopPolicies(input: {
  fulfillment: ListingFulfillmentInfo | null
  returnPolicy: ListingReturnPolicy | null
  deliveryProfile?: DeliveryProfile | null
  currency?: string
}): ListingShopPoliciesModel | null {
  const currency = input.currency ?? 'INR'
  const shipping = buildShippingSection(input.fulfillment, input.deliveryProfile, currency)
  const returns = buildReturnsSection(input.returnPolicy, input.fulfillment, input.deliveryProfile)

  if (!shipping && !returns) return null
  return { shipping, returns }
}

function buildShippingSection(
  fulfillment: ListingFulfillmentInfo | null,
  profile: DeliveryProfile | null | undefined,
  currency: string,
): ShopPolicySection | null {
  if (!fulfillment) return null

  if (fulfillment.kind === 'digital') {
    const points = [
      fulfillment.deliveryLabel,
      'No physical shipping required',
      fulfillment.fileTypeLabel,
      fulfillment.fileSizeLabel,
      fulfillment.downloadLimitLabel,
    ].filter(Boolean) as string[]

    return {
      title: 'Delivery',
      points,
    }
  }

  const points: string[] = []

  if (profile?.profile_name?.trim()) {
    points.push(`Shipping method: ${profile.profile_name.trim()}`)
  }

  points.push(fulfillment.processingLabel)
  points.push(fulfillment.estimatedDeliveryLabel)
  points.push(fulfillment.shippingCostLabel)

  if (
    profile?.free_shipping_threshold != null &&
    profile.free_shipping_threshold > 0 &&
    fulfillment.shippingCostLabel !== 'Free shipping'
  ) {
    points.push(
      `Free shipping on orders over ${formatCurrency(profile.free_shipping_threshold, currency)}`,
    )
  }

  if (fulfillment.shipsFromLabel) points.push(fulfillment.shipsFromLabel)
  if (fulfillment.providerLabel) points.push(`Fulfilled via ${fulfillment.providerLabel}`)

  const details = parseReturnsPolicyNote(profile?.delivery_metadata)

  return {
    title: 'Shipping policy',
    points: unique(points),
    details,
  }
}

function buildReturnsSection(
  policy: ListingReturnPolicy | null,
  fulfillment: ListingFulfillmentInfo | null,
  profile: DeliveryProfile | null | undefined,
): ShopPolicySection | null {
  if (policy) {
    const points = [
      policy.acceptsReturns
        ? policy.returnWindowDays
          ? `Returns accepted within ${policy.returnWindowDays} days of delivery`
          : 'Returns accepted'
        : 'Returns not accepted',
      policy.acceptsExchanges ? 'Exchanges accepted' : 'Exchanges not accepted',
      policy.acceptsRefunds ? 'Refunds available when eligible' : 'Refunds not available',
      policy.returnShippingPaidBy
        ? `Return shipping paid by ${policy.returnShippingPaidBy}`
        : null,
      policy.conditionDescription,
    ].filter(Boolean) as string[]

    return {
      title: policy.policyName?.trim() || 'Returns & refunds',
      points: unique(points),
      details: policy.policyDetails,
    }
  }

  const fallback =
    (fulfillment?.kind === 'physical' ? fulfillment.returnsLabel : null) ??
    parseReturnsPolicyNote(profile?.delivery_metadata)

  if (!fallback) return null

  return {
    title: 'Returns & refunds',
    points: [fallback],
  }
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
