import { fetchVendorInquiries, type VendorInquiry } from '~/commerce/lib/vendor-operations'
import { vendorRoutes } from '~/lib/routes'

export type VendorInquiriesHomeCard = {
  id: string
  listingId: string
  title: string
  preview: string
  badge: string
  href: string
}

export function buildVendorInquiriesHomeCards(
  inquiries: VendorInquiry[],
  limit = 5,
): VendorInquiriesHomeCard[] {
  return inquiries
    .filter((inquiry) => inquiry.status !== 'closed' && !inquiry.reply?.trim())
    .slice(0, limit)
    .map((inquiry) => ({
      id: inquiry.id,
      listingId: inquiry.listingId,
      title: 'Listing inquiry',
      preview: inquiry.message.trim().slice(0, 140) || 'Buyer question',
      badge: inquiry.reply ? 'Follow up' : 'Needs reply',
      href: vendorRoutes.reviews,
    }))
}

export async function fetchVendorInquiriesHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorInquiriesHomeCard[]; error: string | null }> {
  try {
    const inquiries = await fetchVendorInquiries(shopId)
    return { cards: buildVendorInquiriesHomeCards(inquiries, limit), error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Failed to load inquiries',
    }
  }
}

export function vendorInquiriesHomeHref() {
  return vendorRoutes.reviews
}
