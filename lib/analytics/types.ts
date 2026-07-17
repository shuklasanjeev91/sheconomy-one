export type AnalyticsValue = string | number | boolean | null | undefined

export type AnalyticsProperties = Record<string, AnalyticsValue>

export type CommerceAnalyticsItem = {
  id: string
  name: string
  category?: string
  price?: number
  quantity?: number
}

export type CommerceAnalyticsEvent =
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'

export function sanitizeAnalyticsEventName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export function compactAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>
}
