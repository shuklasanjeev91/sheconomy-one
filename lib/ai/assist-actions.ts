/** Structured actions SHERPA can offer (and the listing page can run). */

export type AiAssistActionType =
  | 'add_to_cart'
  | 'checkout'
  | 'message_seller'
  | 'follow_shop'
  | 'open_shop'
  | 'open_cart'
  | 'navigate'

export type AiAssistAction = {
  type: AiAssistActionType
  label: string
  /** Run as soon as the reply lands (clear “add this for me” / “checkout”). */
  autoExecute?: boolean
  listingId?: string
  shopId?: string
  ownerUserId?: string
  href?: string
}

export type ListingAssistHandlers = {
  listingId: string
  shopId?: string | null
  ownerUserId?: string | null
  selectedVariantId?: string | null
  addToCart: () => Promise<{ ok: boolean; error?: string }>
  checkout: () => Promise<{ ok: boolean; error?: string }>
  followShop: () => Promise<{ ok: boolean; error?: string; following?: boolean }>
  messageSeller: () => Promise<{ ok: boolean; error?: string }>
  openShop?: () => void
}

export function parseAiAssistActions(raw: unknown): AiAssistAction[] {
  if (!Array.isArray(raw)) return []
  const out: AiAssistAction[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const type = String(item.type || '')
    const label = String(item.label || '').trim()
    if (
      !label ||
      ![
        'add_to_cart',
        'checkout',
        'message_seller',
        'follow_shop',
        'open_shop',
        'open_cart',
        'navigate',
      ].includes(type)
    ) {
      continue
    }
    out.push({
      type: type as AiAssistActionType,
      label: label.slice(0, 48),
      autoExecute: Boolean(item.autoExecute),
      listingId: item.listingId ? String(item.listingId) : undefined,
      shopId: item.shopId ? String(item.shopId) : undefined,
      ownerUserId: item.ownerUserId ? String(item.ownerUserId) : undefined,
      href: item.href ? String(item.href) : undefined,
    })
  }
  return out.slice(0, 6)
}
