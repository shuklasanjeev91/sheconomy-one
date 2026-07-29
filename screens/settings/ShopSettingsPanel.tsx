import { useEffect } from 'react'

import {
  fetchShopNotificationPrefs,
  saveShopNotificationPrefs,
} from '~/lib/notifications/product-preferences'
import { useAccess } from '~/hooks/useAccess'
import { useVendorShops } from '~/hooks/useVendorShops'
import { replaceApp } from '~/lib/platform/navigate'
import { appRoutes } from '~/lib/routes'

import { ProductChannelSettingsPanel } from '~/screens/settings/ProductChannelSettingsPanel'

export function ShopSettingsPanel() {
  const { canManageShops } = useAccess()
  const { shops } = useVendorShops()
  const showShop = canManageShops || shops.length > 0

  useEffect(() => {
    if (!showShop) {
      replaceApp(appRoutes.settingsSection('account'))
    }
  }, [showShop])

  if (!showShop) return null

  return (
    <ProductChannelSettingsPanel
      title="Manage shop"
      description="Seller alerts for new orders, confirmation nudges, payments, and low stock"
      successLabel="Manage shop alerts"
      emailSubtitle="New orders, confirm-order reminders, and low-stock alerts"
      whatsappSubtitle="Optional seller order alerts on WhatsApp"
      fetchPrefs={fetchShopNotificationPrefs}
      savePrefs={saveShopNotificationPrefs}
    />
  )
}
