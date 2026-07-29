/**
 * Cross-platform analytics (web + iOS + Android).
 * Web uses gtag/Meta/Clarity browser APIs; native uses RN Clarity via dynamic import
 * so web/SSR never loads `@microsoft/react-native-clarity`.
 */
import { Platform } from 'react-native'

import { ANALYTICS_CONFIG, EXTERNAL_ANALYTICS_ENABLED } from '~/lib/analytics/config'
import {
  compactAnalyticsProperties,
  sanitizeAnalyticsEventName,
  type AnalyticsProperties,
  type CommerceAnalyticsEvent,
  type CommerceAnalyticsItem,
} from '~/lib/analytics/types'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    clarity?: (...args: unknown[]) => void
  }
}

type ClarityModule = typeof import('@microsoft/react-native-clarity')

let clarityModule: ClarityModule | null = null
let clarityInitialized = false
let clarityLoading: Promise<ClarityModule | null> | null = null

function loadNativeClarity(): Promise<ClarityModule | null> {
  if (Platform.OS === 'web') return Promise.resolve(null)
  if (clarityModule) return Promise.resolve(clarityModule)
  if (clarityLoading) return clarityLoading

  clarityLoading = import('@microsoft/react-native-clarity')
    .then((mod) => {
      clarityModule = mod
      return mod
    })
    .catch((error) => {
      console.warn('[analytics] Clarity load failed', error)
      return null
    })
    .finally(() => {
      clarityLoading = null
    })

  return clarityLoading
}

function ensureNativeClarity(mod: ClarityModule) {
  if (!EXTERNAL_ANALYTICS_ENABLED || clarityInitialized) return
  try {
    mod.initialize(ANALYTICS_CONFIG.clarityProjectId)
    clarityInitialized = true
  } catch (error) {
    console.warn('[analytics] Clarity init failed', error)
  }
}

export function trackExternalPageView(path: string, title?: string) {
  if (!EXTERNAL_ANALYTICS_ENABLED) return

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return
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
    return
  }

  void loadNativeClarity().then((mod) => {
    if (!mod) return
    ensureNativeClarity(mod)
    mod.setCurrentScreenName(title || path || 'home')
  })
}

export function trackAnalyticsEvent(
  name: string,
  properties: AnalyticsProperties = {},
) {
  if (!EXTERNAL_ANALYTICS_ENABLED) return

  const eventName = sanitizeAnalyticsEventName(name)
  if (!eventName) return
  const payload = compactAnalyticsProperties(properties)

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return
    window.dataLayer?.push({ event: eventName, ...payload })
    window.gtag?.('event', eventName, payload)
    window.fbq?.('trackCustom', eventName, payload)
    window.clarity?.('event', eventName)
    return
  }

  void loadNativeClarity().then((mod) => {
    if (!mod) return
    ensureNativeClarity(mod)
    void payload
    mod.sendCustomEvent(eventName)
  })
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

  if (!EXTERNAL_ANALYTICS_ENABLED) return

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return
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
    return
  }

  trackAnalyticsEvent(event, properties)
}
