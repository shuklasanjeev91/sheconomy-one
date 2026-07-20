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
}

export type PostDraftResult = {
  title: string | null
  content: string
  usedFallback: boolean
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
