import {
  fetchChatNotificationPrefs,
  saveChatNotificationPrefs,
} from '~/lib/notifications/product-preferences'

import { ProductChannelSettingsPanel } from '~/screens/settings/ProductChannelSettingsPanel'

export function ChatSettingsPanel() {
  return (
    <ProductChannelSettingsPanel
      title="Chat"
      description="Messages and call alerts across web, iOS, and Android"
      successLabel="Chat alerts"
      emailSubtitle="Email for chat is optional; most alerts are in-app + push"
      whatsappSubtitle="Optional WhatsApp for important chat alerts"
      hideWhatsApp
      fetchPrefs={fetchChatNotificationPrefs}
      savePrefs={saveChatNotificationPrefs}
    />
  )
}
