import {
  fetchCoworkNotificationPrefs,
  saveCoworkNotificationPrefs,
} from '~/lib/notifications/product-preferences'

import { ProductChannelSettingsPanel } from './ProductChannelSettingsPanel'

export function CoWorkSettingsPanel() {
  return (
    <ProductChannelSettingsPanel
      title="Co-Work"
      description="Meeting invites, reminders, and recordings"
      successLabel="Co-Work alerts"
      emailSubtitle="Meeting invites, reminders, and recordings"
      whatsappSubtitle="Optional meeting reminders on WhatsApp"
      fetchPrefs={fetchCoworkNotificationPrefs}
      savePrefs={saveCoworkNotificationPrefs}
    />
  )
}
