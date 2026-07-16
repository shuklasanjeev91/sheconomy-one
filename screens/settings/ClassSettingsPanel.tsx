import {
  fetchClassNotificationPrefs,
  saveClassNotificationPrefs,
} from '~/lib/notifications/product-preferences'

import { ProductChannelSettingsPanel } from './ProductChannelSettingsPanel'

export function ClassSettingsPanel() {
  return (
    <ProductChannelSettingsPanel
      title="Classes"
      description="Enrollment confirmation and new lesson alerts"
      successLabel="Class alerts"
      emailSubtitle="Enrollment confirmation and new lessons"
      whatsappSubtitle="Optional Class reminders on WhatsApp"
      fetchPrefs={fetchClassNotificationPrefs}
      savePrefs={saveClassNotificationPrefs}
    />
  )
}
