import * as Clarity from '@microsoft/react-native-clarity'

import { ANALYTICS_CONFIG, EXTERNAL_ANALYTICS_ENABLED } from './config'
import {
  compactAnalyticsProperties,
  sanitizeAnalyticsEventName,
  type AnalyticsProperties,
  type CommerceAnalyticsEvent,
  type CommerceAnalyticsItem,
} from './types'

let clarityInitialized = false

function ensureClarity() {
  if (!EXTERNAL_ANALYTICS_ENABLED || clarityInitialized) return
  Clarity.initialize(ANALYTICS_CONFIG.clarityProjectId)
  clarityInitialized = true
}

export function trackExternalPageView(path: string, title?: string) {
  if (!EXTERNAL_ANALYTICS_ENABLED) return
  ensureClarity()
  Clarity.setCurrentScreenName(title || path || 'home')
}

export function trackAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
) {
  if (!EXTERNAL_ANALYTICS_ENABLED) return
  ensureClarity()

  const eventName = sanitizeAnalyticsEventName(name)
  if (!eventName) return

  // Keep the event name for Clarity Smart Events/Funnels.
  // Properties are intentionally not stringified into the event name.
  void compactAnalyticsProperties(properties)
  Clarity.sendCustomEvent(eventName)
}

export function trackCommerceEvent(
  event: CommerceAnalyticsEvent,
  options: {
    currency?: string
    value?: number
    transactionId?: string
    items: CommerceAnalyticsItem[]
  },
) {
  trackAnalyticsEvent(event, {
    currency: options.currency ?? 'INR',
    value: options.value,
    transaction_id: options.transactionId,
    item_count: options.items.reduce((total, item) => total + (item.quantity ?? 1), 0),
  })
}
