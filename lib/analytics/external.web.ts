import { EXTERNAL_ANALYTICS_ENABLED } from './config'
import {
  compactAnalyticsProperties,
  sanitizeAnalyticsEventName,
  type AnalyticsProperties,
  type CommerceAnalyticsEvent,
  type CommerceAnalyticsItem,
} from './types'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    clarity?: (...args: unknown[]) => void
  }
}

export function trackExternalPageView(path: string, title?: string) {
  if (!EXTERNAL_ANALYTICS_ENABLED || typeof window === 'undefined') return

  const pageLocation = new URL(path, window.location.origin).toString()
  const payload = {
    page_location: pageLocation,
    page_path: path,
    page_title: title || document.title,
  }

  window.dataLayer?.push({ event: 'page_view', ...payload })
  window.gtag?.('event', 'page_view', payload)
  window.fbq?.('track', 'PageView')
  window.clarity?.('set', 'route', path)
}

export function trackAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
) {
  if (!EXTERNAL_ANALYTICS_ENABLED || typeof window === 'undefined') return

  const eventName = sanitizeAnalyticsEventName(name)
  if (!eventName) return

  const payload = compactAnalyticsProperties(properties)
  window.dataLayer?.push({ event: eventName, ...payload })
  window.gtag?.('event', eventName, payload)
  window.fbq?.('trackCustom', eventName, payload)
  window.clarity?.('event', eventName)
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
  const properties: AnalyticsProperties = {
    currency: options.currency ?? 'INR',
    value: options.value,
    transaction_id: options.transactionId,
    item_count: options.items.reduce((total, item) => total + (item.quantity ?? 1), 0),
  }

  if (!EXTERNAL_ANALYTICS_ENABLED || typeof window === 'undefined') return

  const items = options.items.map((item) => ({
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity ?? 1,
  }))
  const payload = { ...compactAnalyticsProperties(properties), items }

  window.dataLayer?.push({ event, ...payload })
  window.gtag?.('event', event, payload)

  const metaEvent =
    event === 'view_item'
      ? 'ViewContent'
      : event === 'add_to_cart'
        ? 'AddToCart'
        : event === 'begin_checkout'
          ? 'InitiateCheckout'
          : 'Purchase'

  window.fbq?.('track', metaEvent, {
    content_ids: options.items.map((item) => item.id),
    content_name: options.items[0]?.name,
    content_type: 'product',
    currency: options.currency ?? 'INR',
    value: options.value,
  })
  window.clarity?.('event', event)
}
