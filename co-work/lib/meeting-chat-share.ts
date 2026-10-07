import { fetchActiveListingCards } from '~/commerce/lib/commerce'
import { supabase } from '~/lib/supabase/client'
import { appRoutes, commerceRoutes } from '~/lib/routes'
import type { MeetingParticipant } from '~/co-work/lib/types'

export type MeetingChatShareKind = 'shop' | 'listing' | 'profile'

export type MeetingChatShare = {
  kind: MeetingChatShareKind
  id: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  href: string
  ownerUserId?: string | null
  price?: number | null
  currency?: string | null
}

export function meetingChatShareMetadata(share: MeetingChatShare): { share: MeetingChatShare } {
  return { share: normalizeMeetingChatShare(share)! }
}

export function parseMeetingChatShareMetadata(metadata: unknown): MeetingChatShare | null {
  if (!metadata || typeof metadata !== 'object') return null
  return normalizeMeetingChatShare((metadata as { share?: unknown }).share)
}

function normalizeMeetingChatShare(value: unknown): MeetingChatShare | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const kind = row.kind
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const href = typeof row.href === 'string' ? row.href.trim() : ''
  if (kind !== 'shop' && kind !== 'listing' && kind !== 'profile') return null
  if (!id || !title || !href.startsWith('/')) return null
  return {
    kind,
    id,
    title,
    href,
    subtitle: typeof row.subtitle === 'string' ? row.subtitle.trim() : null,
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
    ownerUserId: typeof row.ownerUserId === 'string' ? row.ownerUserId : null,
    price: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
  }
}

export async function fetchMeetingChatShopShares(userId: string): Promise<MeetingChatShare[]> {
  const { data } = await supabase
    .from('shops')
    .select('id, shop_name, slug, logo_url, shop_description, user_id, verified, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8)

  return (data ?? []).map((shop) => ({
    kind: 'shop' as const,
    id: shop.id,
    title: shop.shop_name ?? 'Shop',
    subtitle: shop.shop_description ?? (shop.verified ? 'Verified shop' : 'Shop'),
    imageUrl: shop.logo_url ?? null,
    href: String(commerceRoutes.shop(shop.slug ?? shop.id)),
    ownerUserId: shop.user_id ?? null,
  }))
}

export async function fetchMeetingChatProductShares(userId: string): Promise<MeetingChatShare[]> {
  const shops = await fetchMeetingChatShopShares(userId)
  const listingGroups = await Promise.all(
    shops.slice(0, 4).map((shop) => fetchActiveListingCards({ shopId: shop.id, limit: 4 })),
  )
  return listingGroups.flat().slice(0, 12).map((listing) => ({
    kind: 'listing' as const,
    id: listing.id,
    title: listing.card_title || listing.title,
    subtitle: listing.shop_name ?? 'Product',
    imageUrl: listing.image_url ?? listing.image_urls[0] ?? null,
    href: String(commerceRoutes.listing(listing.slug ?? listing.id)),
    ownerUserId: listing.shop_owner_user_id ?? null,
    price: listing.price,
    currency: listing.currency,
  }))
}

export function buildMeetingChatProfileShares(
  participants: MeetingParticipant[],
  currentUserId?: string | null,
): MeetingChatShare[] {
  return participants
    .filter((row) => row.status === 'admitted' && row.user_id !== currentUserId)
    .map((row) => {
      const handle = row.profile?.username || row.user_id
      const name = row.display_name || row.profile?.full_name || row.profile?.username || 'Participant'
      return {
        kind: 'profile' as const,
        id: row.user_id,
        title: name,
        subtitle: row.profile?.username ? `@${row.profile.username}` : 'Meeting participant',
        imageUrl: row.profile?.avatar_url ?? null,
        href: String(appRoutes.userProfile(handle)),
        ownerUserId: row.user_id,
      }
    })
}
