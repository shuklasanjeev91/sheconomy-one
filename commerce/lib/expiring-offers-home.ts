import { fetchAvailableOffers } from '~/commerce/lib/discounts'
import type { AvailableOffer } from '~/commerce/lib/offer-utils'
import { commerceRoutes } from '~/lib/routes'

export type ExpiringOfferHomeCard = {
  id: string
  code: string
  title: string
  detail: string
  expiresAt: string
  href: string
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function buildExpiringOfferHomeCards(
  offers: AvailableOffer[],
  nowMs = Date.now(),
  limit = 3,
): ExpiringOfferHomeCard[] {
  const soon = offers
    .filter((offer) => {
      if (!offer.validUntil) return false
      const expiresMs = new Date(offer.validUntil).getTime()
      if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return false
      return expiresMs - nowMs <= SEVEN_DAYS_MS
    })
    .sort((a, b) => {
      const aMs = new Date(a.validUntil!).getTime()
      const bMs = new Date(b.validUntil!).getTime()
      return aMs - bMs
    })
    .slice(0, limit)

  return soon.map((offer) => ({
    id: offer.id,
    code: offer.code,
    title: offer.name,
    detail: offer.description?.trim() || 'Use this code before it expires.',
    expiresAt: offer.validUntil!,
    href: String(commerceRoutes.browse('featured')),
  }))
}

export async function fetchExpiringOfferHomeCards(
  limit = 3,
): Promise<{ cards: ExpiringOfferHomeCard[]; error: string | null }> {
  try {
    const offers = await fetchAvailableOffers()
    return { cards: buildExpiringOfferHomeCards(offers, Date.now(), limit), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load offers'
    return { cards: [], error: message }
  }
}

export function expiringOffersHomeHref() {
  return commerceRoutes.browse('featured')
}
