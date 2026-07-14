import { supabase } from '~/lib/supabase/client'

export type ListingReturnPolicy = {
  policyName: string
  acceptsReturns: boolean
  acceptsExchanges: boolean
  acceptsRefunds: boolean
  returnWindowDays: number | null
  returnShippingPaidBy: string | null
  conditionDescription: string | null
  policyDetails: string | null
}

/** Resolve the return/exchange policy linked to a listing (or the shop default). */
export async function fetchListingReturnPolicy(
  listingId: string,
  shopId?: string | null,
): Promise<ListingReturnPolicy | null> {
  const { data: linked } = await supabase
    .from('listing_return_policies')
    .select(
      `
      return_policies (
        policy_name,
        accepts_returns,
        accepts_exchanges,
        accepts_refunds,
        return_window_days,
        return_shipping_paid_by,
        condition_description,
        policy_details,
        is_active
      )
    `,
    )
    .eq('listing_id', listingId)
    .limit(1)
    .maybeSingle()

  const linkedPolicy = Array.isArray(linked?.return_policies)
    ? linked?.return_policies[0]
    : linked?.return_policies

  if (linkedPolicy && (linkedPolicy as { is_active?: boolean }).is_active !== false) {
    return mapPolicy(linkedPolicy as Record<string, unknown>)
  }

  if (!shopId) return null

  const { data: shopDefault } = await supabase
    .from('return_policies')
    .select(
      'policy_name, accepts_returns, accepts_exchanges, accepts_refunds, return_window_days, return_shipping_paid_by, condition_description, policy_details, is_active',
    )
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!shopDefault) return null
  return mapPolicy(shopDefault as Record<string, unknown>)
}

function mapPolicy(row: Record<string, unknown>): ListingReturnPolicy {
  return {
    policyName: String(row.policy_name ?? 'Return policy'),
    acceptsReturns: !!row.accepts_returns,
    acceptsExchanges: !!row.accepts_exchanges,
    acceptsRefunds: !!row.accepts_refunds,
    returnWindowDays:
      row.return_window_days == null ? null : Number(row.return_window_days),
    returnShippingPaidBy:
      row.return_shipping_paid_by == null ? null : String(row.return_shipping_paid_by),
    conditionDescription:
      row.condition_description == null ? null : String(row.condition_description),
    policyDetails: row.policy_details == null ? null : String(row.policy_details),
  }
}
