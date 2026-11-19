export type AiProduct =
  | 'commerce'
  | 'community'
  | 'chat'
  | 'class'
  | 'cowork'
  | 'shop'
  | 'account'

export type AiContext = {
  route?: string
  listing_id?: string
  shop_id?: string
  meeting_id?: string
  chat_id?: string
  [key: string]: unknown
}

export type AiSuggestion = {
  id: string
  product?: AiProduct | string | null
  context_page?: string | null
  suggestion_text: string
  suggestion_action: string
  icon_name?: string | null
  priority?: number | null
  usage_count?: number | null
  success_rate?: number | null
  href?: string | null
}

export type AiDeepLink = {
  label: string
  href: string
}

export type AiAssistMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  deepLinks?: AiDeepLink[]
  listingIds?: string[]
}

export type AiRouteContext = {
  product: AiProduct
  contextPage: string
  context: AiContext
}

export type FetchAiSuggestionsParams = {
  product: AiProduct
  contextPage?: string
}

export type SendAiMessageParams = {
  product: AiProduct
  message: string
  sessionId?: string | null
  contextPage?: string
  context?: AiContext
}

export type SendAiMessageResult = {
  sessionId: string
  answer: string
  deepLinks: AiDeepLink[]
  listingIds: string[]
  usedFallback: boolean
  product: AiProduct
}

export type AiFeedbackParams = {
  suggestionId: string
  helpful?: boolean
  message?: string
}

export type CommentSuggestionParams = {
  postType?: string | null
  content?: string | null
  authorName?: string | null
  eventTitle?: string | null
  celebrationTitle?: string | null
  productTitle?: string | null
  shopName?: string | null
  articleTitle?: string | null
  hasMedia?: boolean
  imageUrl?: string | null
  hasVideo?: boolean
  parentComment?: string | null
}

export type MeetingDraftParams = {
  /** Natural language: "weekly design sync tomorrow 4pm about launch" */
  prompt: string
  timeZone?: string
}

export type MeetingDraftResult = {
  title: string
  description: string
  /** ISO datetime suggestion when parseable; otherwise null */
  scheduledAt: string | null
  maxParticipants: number | null
  agenda: string[]
  usedFallback: boolean
}

export type PostDraftParams = {
  prompt: string
  mode?: string | null
  photoCount?: number
  videoCount?: number
  link?: { url: string; title?: string | null; description?: string | null } | null
}

export type PostDraftResult = {
  title: string | null
  content: string
  usedFallback: boolean
}

export type PostSuggestionChip = {
  label: string
  draft: string
}

export type WritingIssue = {
  start: number
  end: number
  type: 'spelling' | 'grammar'
  message: string
  suggestions: string[]
}

export type ShopDraftParams = {
  /** Seed: category, vibe, current name, or free-text brief. */
  prompt?: string
  categories?: string[]
  currentName?: string | null
  currentDescription?: string | null
}

export type ShopDraftResult = {
  names: string[]
  description: string
  usedFallback: boolean
}

export type DescribeSearchImageParams = {
  /** data:image/...;base64,... */
  dataUrl: string
}

export type DescribeSearchImageResult = {
  query: string
  category: string | null
  attributes: string[]
  usedFallback: boolean
}

export type ListingDraftFromImageParams = {
  /** data:image/...;base64,... */
  dataUrl: string
}

export type ListingDraftFromImageResult = {
  title: string
  description: string
  tags: string[]
  suggestedPriceInr: number | null
  priceNote: string
  categoryHint: string | null
  metaTitle: string
  metaDescription: string
  usedFallback: boolean
}

export type AiSearchParams = {
  message: string
  location?: string | null
}

export type AiSearchFilters = {
  minPrice?: number | null
  maxPrice?: number | null
  listingType?: 'physical' | 'digital' | null
  category?: string | null
}

export type AiSearchGroup = {
  label: string
  listingIds: string[]
}

export type AiResultKind =
  | 'listing'
  | 'person'
  | 'shop'
  | 'job'
  | 'program'
  | 'post'
  | 'company'
  | 'event'
  | 'meeting'
  | 'help'

export type AiEntityHit = {
  id: string
  kind: string
  title: string
  subtitle: string
  href: string
}

export type AiSearchResult = {
  answer: string
  searchTerm: string
  filters: AiSearchFilters
  listingIds: string[]
  groups: AiSearchGroup[]
  resultKind: AiResultKind
  entityIds: string[]
  hits: AiEntityHit[]
  deepLinks: AiDeepLink[]
  usedFallback: boolean
}
