import { commerceRoutes } from '~/lib/routes'

export type CreateShopHomeCard = {
  headline: string
  detail: string
  href: string
}

export function buildCreateShopHomeCard(input: {
  isAuthenticated: boolean
  canManageShops: boolean
  hasShops: boolean
}): CreateShopHomeCard | null {
  if (!input.isAuthenticated || !input.canManageShops || input.hasShops) return null

  return {
    headline: 'Open your shop on SHEconomy',
    detail: 'List products, reach the community, and start selling in minutes.',
    href: String(commerceRoutes.createShop),
  }
}

export function createShopHomeHref() {
  return commerceRoutes.createShop
}
