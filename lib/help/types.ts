export type HelpProduct =
  | ''
  | 'commerce'
  | 'community'
  | 'chat'
  | 'class'
  | 'cowork'
  | 'shop'

export type HelpTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type HelpTicketPriority = 'normal' | 'high'

export const HELP_PRODUCT_FILTERS: Array<{ key: HelpProduct; label: string }> = [
  { key: '', label: 'All' },
  { key: 'commerce', label: 'Commerce' },
  { key: 'community', label: 'Community' },
  { key: 'chat', label: 'Chat' },
  { key: 'class', label: 'Class' },
  { key: 'cowork', label: 'Co-Work' },
  { key: 'shop', label: 'Manage shop' },
]

export function helpProductLabel(product: string | null | undefined): string {
  const found = HELP_PRODUCT_FILTERS.find((item) => item.key && item.key === product)
  return found?.label ?? 'General'
}

export function parseHelpProduct(value: string | null | undefined): HelpProduct {
  if (!value) return ''
  const allowed = HELP_PRODUCT_FILTERS.map((f) => f.key).filter(Boolean) as Exclude<
    HelpProduct,
    ''
  >[]
  return allowed.includes(value as Exclude<HelpProduct, ''>)
    ? (value as HelpProduct)
    : ''
}

export type HelpArticle = {
  id: string
  title: string
  content: string
  category: string
  tags: string[] | null
  helpful_count: number | null
  view_count: number | null
  source: 'kb' | 'fallback'
  slug?: string | null
}

/** Build Help hub href with optional product + article slug. */
export function helpHref(product?: HelpProduct | string | null, articleSlug?: string | null) {
  const params = new URLSearchParams()
  if (product) params.set('product', product)
  if (articleSlug) params.set('article', articleSlug)
  const qs = params.toString()
  return qs ? (`/help?${qs}` as const) : (`/help` as const)
}

export type SupportTicket = {
  id: string
  subject: string
  description: string
  status: string
  product: string | null
  priority: string | null
  created_at: string
  updated_at: string | null
}
