import {
  fetchCoworkNotificationPrefs,
  saveCoworkNotificationPrefs,
} from '~/lib/notifications/product-preferences'

import { ProductChannelSettingsPanel } from '~/screens/settings/ProductChannelSettingsPanel'

export function CoWorkSettingsPanel() {
  return (
    <ProductChannelSettingsPanel
      title="Co-Work"
      description="Meeting invites, reminders before start, waiting-room requests, and join alerts"
      successLabel="Co-Work alerts"
      emailSubtitle="Meeting invites, schedule reminders, and cancellations"
      whatsappSubtitle="Optional meeting reminders on WhatsApp"
      fetchPrefs={fetchCoworkNotificationPrefs}
      savePrefs={saveCoworkNotificationPrefs}
    />
  )
}
