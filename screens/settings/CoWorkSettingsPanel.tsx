import {
  fetchCoworkNotificationPrefs,
  saveCoworkNotificationPrefs,
} from '~/lib/notifications/product-preferences'

import { ProductChannelSettingsPanel } from '~/screens/settings/ProductChannelSettingsPanel'

export function CoWorkSettingsPanel() {
  return (
    <ProductChannelSettingsPanel
      title="Co-Work"
      description="Meeting invites, 30/5-minute reminders, and recordings"
      successLabel="Co-Work alerts"
      emailSubtitle="Meeting invites, reminders, and recordings"
      whatsappSubtitle="Optional meeting reminders on WhatsApp"
      fetchPrefs={fetchCoworkNotificationPrefs}
      savePrefs={saveCoworkNotificationPrefs}
    />
  )
}
