import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'

export type ListingInquiryInput = {
  listingId: string
  shopId: string
  sellerId: string
  buyerId: string
  message: string
}

/** Submit an marketplace “ask the seller” question on a listing. */
export async function submitListingInquiry(
  input: ListingInquiryInput,
): Promise<{ error: string | null }> {
  const message = input.message.trim()
  if (message.length < 3) return { error: 'Please write a short question.' }
  if (message.length > 2000) return { error: 'Question is too long.' }
  if (input.buyerId === input.sellerId) {
    return { error: 'You cannot ask a question on your own listing.' }
  }

  const { error } = await supabase.from('listing_inquiries').insert({
    listing_id: input.listingId,
    shop_id: input.shopId,
    seller_id: input.sellerId,
    buyer_id: input.buyerId,
    message,
    status: 'open',
  })

  if (!error) {
    invalidateCache(INVALIDATION_TOPICS.commerceInquiries)
  }

  return { error: error?.message ?? null }
}
