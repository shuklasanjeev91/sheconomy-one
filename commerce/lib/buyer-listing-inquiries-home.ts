import { supabase } from '~/lib/supabase/client'
import { commerceRoutes } from '~/lib/routes'

export type BuyerListingInquiryRow = {
  id: string
  message: string
  status: string
  sellerReply: string | null
  repliedAt: string | null
  createdAt: string
  updatedAt: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
}

export type BuyerListingInquiryCard = {
  inquiryId: string
  listingId: string
  listingSlug: string | null
  title: string
  badge: string
  preview: string
  href: string
}

export async function fetchBuyerListingInquiries(buyerId: string): Promise<BuyerListingInquiryRow[]> {
  const { data, error } = await supabase
    .from('listing_inquiries')
    .select(
      'id, message, status, seller_reply, replied_at, created_at, updated_at, listing_id, listings!listing_inquiries_listing_id_fkey(title, slug)',
    )
    .eq('buyer_id', buyerId)
    .neq('status', 'closed')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) return []

  return (data ?? []).map((row) => {
    const listing = row.listings as { title?: string; slug?: string | null } | null
    return {
      id: String(row.id),
      message: String(row.message ?? ''),
      status: String(row.status ?? 'open'),
      sellerReply: typeof row.seller_reply === 'string' ? row.seller_reply : null,
      repliedAt: row.replied_at ? String(row.replied_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      listingId: String(row.listing_id),
      listingTitle: listing?.title?.trim() || 'Listing',
      listingSlug: listing?.slug ?? null,
    }
  })
}

export function buildBuyerListingInquiryCards(
  rows: BuyerListingInquiryRow[],
  limit = 5,
): BuyerListingInquiryCard[] {
  return rows
    .filter((row) => row.status === 'open' || (row.status === 'replied' && row.sellerReply))
    .slice(0, limit)
    .map((row) => ({
      inquiryId: row.id,
      listingId: row.listingId,
      listingSlug: row.listingSlug,
      title: row.listingTitle,
      badge: row.sellerReply ? 'Seller replied' : 'Awaiting reply',
      preview: row.sellerReply ?? row.message,
      href: commerceRoutes.listing(row.listingSlug ?? row.listingId),
    }))
}
