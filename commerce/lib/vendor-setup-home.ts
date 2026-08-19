import { fetchShopCommerceSettings, type ShopPartnerInfo } from '~/commerce/lib/shop-commerce'
import { vendorRoutes } from '~/lib/routes'

export type VendorSetupHomeTask = {
  id: 'payment' | 'shipping'
  title: string
  detail: string
  href: string
}

export type VendorSetupHomeCard = {
  id: string
  title: string
  badge: string
  detail: string
  href: string
}

export function buildVendorSetupHomeTasks(info: ShopPartnerInfo): VendorSetupHomeTask[] {
  const tasks: VendorSetupHomeTask[] = []

  if (!info.paymentConnected) {
    tasks.push({
      id: 'payment',
      title: 'Connect payments',
      detail: `Buyers checkout through ${info.paymentLabel}. Connect your account to receive payouts.`,
      href: vendorRoutes.settingsSection('payments'),
    })
  }

  if (!info.shippingConnected) {
    tasks.push({
      id: 'shipping',
      title: 'Connect shipping',
      detail: `Fulfillment uses ${info.shippingLabel}. Link your courier account for labels and tracking.`,
      href: vendorRoutes.settingsSection('shipping'),
    })
  }

  return tasks
}

export function buildVendorSetupHomeCards(
  tasks: VendorSetupHomeTask[],
  limit = 2,
): VendorSetupHomeCard[] {
  return tasks.slice(0, limit).map((task) => ({
    id: task.id,
    title: task.title,
    badge: 'Setup needed',
    detail: task.detail,
    href: task.href,
  }))
}

export async function fetchVendorSetupHomeCards(
  shopId: string,
  limit = 2,
): Promise<{ cards: VendorSetupHomeCard[]; error: string | null }> {
  const settings = await fetchShopCommerceSettings([shopId])
  const info = settings.get(shopId)
  if (!info) return { cards: [], error: null }

  return {
    cards: buildVendorSetupHomeCards(buildVendorSetupHomeTasks(info), limit),
    error: null,
  }
}

export function vendorSetupHomeHref() {
  return vendorRoutes.settings
}
