import { supabase } from '~/lib/supabase'

import type {
  AiFeedbackParams,
  AiSearchParams,
  AiSearchResult,
  AiSuggestion,
  CommentSuggestionParams,
  DescribeSearchImageParams,
  DescribeSearchImageResult,
  FetchAiSuggestionsParams,
  ListingDraftFromImageParams,
  ListingDraftFromImageResult,
  MeetingDraftParams,
  MeetingDraftResult,
  PostDraftParams,
  PostDraftResult,
  SendAiMessageParams,
  SendAiMessageResult,
  ShopDraftParams,
  ShopDraftResult,
} from '~/lib/ai/types'

export type {
  AiSearchResult,
  DescribeSearchImageResult,
  ListingDraftFromImageResult,
} from '~/lib/ai/types'

type InvokeErrorPayload = {
  error?: string
}

/**
 * supabase-js wraps non-2xx as FunctionsHttpError with a generic message.
 * The real reason is usually in `data.error` or `error.context` (Response body).
 */
async function readFunctionErrorMessage(error: unknown, data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as InvokeErrorPayload).error
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = (await context.clone().json()) as InvokeErrorPayload
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
      } catch {
        // ignore
      }
    }
    if (context && typeof context === 'object' && typeof (context as { json?: unknown }).json === 'function') {
      try {
        const body = (await (context as Response).clone().json()) as InvokeErrorPayload
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
      } catch {
        // ignore
      }
    }
  }
  if (error instanceof Error && error.message && !/non-2xx/i.test(error.message)) {
    return error.message
  }
  return fallback
}

async function invokeAiAssist<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body })

  if (error) {
    throw new Error(
      await readFunctionErrorMessage(error, data, 'SHEconomy AI is unavailable right now.'),
    )
  }

  if (data && typeof data === 'object' && 'error' in data && (data as InvokeErrorPayload).error) {
    throw new Error(String((data as InvokeErrorPayload).error))
  }

  return data as T
}

export async function fetchAiSuggestions(
  params: FetchAiSuggestionsParams,
): Promise<AiSuggestion[]> {
  const result = await invokeAiAssist<{ suggestions?: AiSuggestion[] }>({
    action: 'suggestions',
    product: params.product,
    contextPage: params.contextPage,
  })
  return Array.isArray(result.suggestions) ? result.suggestions : []
}

export async function sendAiMessage(params: SendAiMessageParams): Promise<SendAiMessageResult> {
  const result = await invokeAiAssist<SendAiMessageResult>({
    action: 'chat',
    product: params.product,
    message: params.message,
    sessionId: params.sessionId ?? null,
    contextPage: params.contextPage,
    context: {
      ...(params.context ?? {}),
      time_zone:
        (typeof params.context?.time_zone === 'string' && params.context.time_zone) ||
        (typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'Asia/Kolkata'),
    },
  })

  if (!result?.sessionId || !result.answer) {
    throw new Error('Empty response from SHEconomy AI.')
  }

  return {
    ...result,
    deepLinks: Array.isArray(result.deepLinks) ? result.deepLinks : [],
    usedFallback: Boolean(result.usedFallback),
  }
}

export async function sendAiSuggestionFeedback(params: AiFeedbackParams): Promise<void> {
  await invokeAiAssist<{ ok?: boolean }>({
    action: 'feedback',
    suggestionId: params.suggestionId,
    helpful: params.helpful !== false,
    message: params.message,
  })
}

/** Professional comment starters for a community post. */
export async function fetchCommentSuggestions(
  params: CommentSuggestionParams,
): Promise<string[]> {
  const result = await invokeAiAssist<{ suggestions?: string[] }>({
    action: 'comment_suggestions',
    product: 'community',
    context: {
      post_type: params.postType ?? null,
      post_content: params.content ?? null,
      author_name: params.authorName ?? null,
      event_title: params.eventTitle ?? null,
      celebration_title: params.celebrationTitle ?? null,
      product_title: params.productTitle ?? null,
      shop_name: params.shopName ?? null,
      article_title: params.articleTitle ?? null,
      has_media: Boolean(params.hasMedia),
    },
  })
  return Array.isArray(result.suggestions)
    ? result.suggestions.map((s) => String(s).trim()).filter(Boolean)
    : []
}

/** Zoom/Google-like natural-language meeting draft for Co-Work schedule. */
export async function draftMeetingWithAi(
  params: MeetingDraftParams,
): Promise<MeetingDraftResult> {
  const result = await invokeAiAssist<MeetingDraftResult>({
    action: 'meeting_draft',
    product: 'cowork',
    message: params.prompt,
    context: {
      time_zone: params.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })

  return {
    title: String(result.title ?? '').trim(),
    description: String(result.description ?? '').trim(),
    scheduledAt: typeof result.scheduledAt === 'string' ? result.scheduledAt : null,
    maxParticipants:
      typeof result.maxParticipants === 'number' && Number.isFinite(result.maxParticipants)
        ? result.maxParticipants
        : null,
    agenda: Array.isArray(result.agenda)
      ? result.agenda.map((item) => String(item).trim()).filter(Boolean)
      : [],
    usedFallback: Boolean(result.usedFallback),
  }
}

/** Shop name + description ideas for seller onboarding. */
export async function draftShopWithAi(params: ShopDraftParams = {}): Promise<ShopDraftResult> {
  try {
    const result = await invokeAiAssist<ShopDraftResult>({
      action: 'shop_draft',
      product: 'shop',
      message:
        params.prompt?.trim() ||
        'Suggest shop names and a short description for a women-owned storefront',
      context: {
        categories: Array.isArray(params.categories) ? params.categories : [],
        current_name: params.currentName?.trim() || null,
        current_description: params.currentDescription?.trim() || null,
      },
    })

    const names = Array.isArray(result.names)
      ? result.names
          .map((name) => String(name).trim())
          .filter((name) => name.length >= 2 && name.length <= 200)
      : []

    if (names.length > 0) {
      return {
        names: names.slice(0, 6),
        description: String(result.description ?? '').trim().slice(0, 1000),
        usedFallback: Boolean(result.usedFallback),
      }
    }
  } catch {
    // Edge function missing / offline — use local ideas so the UI still works.
  }

  return localShopDraftFallback(params)
}

function localShopDraftFallback(params: ShopDraftParams): ShopDraftResult {
  const category = params.categories?.[0] || 'handmade goods'
  const seed =
    params.currentName?.trim() ||
    params.prompt?.trim().slice(0, 28) ||
    'Studio'
  const base = seed.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim() || 'Velvet'
  return {
    names: [
      `${base} Collective`,
      `The ${base} Shop`,
      `${base} & Co.`,
      `Maison ${base}`,
      `${base} Atelier`,
      `Little ${base}`,
    ].map((name) => name.slice(0, 40)),
    description: `A women-owned shop for ${category.toLowerCase()}. Thoughtfully made pieces, honest details, and a warm welcome for every shopper.`,
    usedFallback: true,
  }
}

/** Professional post draft for community compose (web + native). */
export async function draftPostWithAi(params: PostDraftParams): Promise<PostDraftResult> {
  const result = await invokeAiAssist<PostDraftResult>({
    action: 'post_draft',
    product: 'community',
    message: params.prompt,
    context: {
      compose_mode: params.mode ?? 'text',
    },
  })

  return {
    title: typeof result.title === 'string' && result.title.trim() ? result.title.trim() : null,
    content: String(result.content ?? '').trim(),
    usedFallback: Boolean(result.usedFallback),
  }
}

/** Turn a product photo into marketplace search keywords. */
export async function describeSearchImage(
  params: DescribeSearchImageParams,
): Promise<DescribeSearchImageResult> {
  const result = await invokeAiAssist<DescribeSearchImageResult>({
    action: 'describe_search_image',
    product: 'commerce',
    message: params.dataUrl,
  })

  const query = String(result.query ?? '').trim()
  if (!query) {
    throw new Error('Could not identify the product. Try another photo.')
  }

  return {
    query,
    category:
      typeof result.category === 'string' && result.category.trim()
        ? result.category.trim()
        : null,
    attributes: Array.isArray(result.attributes)
      ? result.attributes.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [],
    usedFallback: Boolean(result.usedFallback),
  }
}

/** Draft listing title, description, tags, and price hint from a product photo. */
export async function draftListingFromImage(
  params: ListingDraftFromImageParams,
): Promise<ListingDraftFromImageResult> {
  const result = await invokeAiAssist<ListingDraftFromImageResult>({
    action: 'listing_draft_from_image',
    product: 'commerce',
    message: params.dataUrl,
  })

  const title = String(result.title ?? '').trim()
  const description = String(result.description ?? '').trim()
  if (!title || !description) {
    throw new Error('Could not draft listing copy from this photo. Try another angle.')
  }

  const priceRaw = result.suggestedPriceInr
  const suggestedPriceInr =
    typeof priceRaw === 'number' && Number.isFinite(priceRaw) && priceRaw > 0
      ? Math.round(priceRaw)
      : null

  return {
    title: title.slice(0, 120),
    description: description.slice(0, 4000),
    tags: Array.isArray(result.tags)
      ? result.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
      : [],
    suggestedPriceInr,
    categoryHint:
      typeof result.categoryHint === 'string' && result.categoryHint.trim()
        ? result.categoryHint.trim()
        : null,
    usedFallback: Boolean(result.usedFallback),
  }
}

/** Natural-language product search with structured filters + listing hits. */
export async function searchWithAi(params: AiSearchParams): Promise<AiSearchResult> {
  const result = await invokeAiAssist<AiSearchResult>({
    action: 'ai_search',
    product: 'commerce',
    message: params.message,
  })

  const searchTerm = String(result.searchTerm ?? '').trim() || params.message.trim()
  const filters = result.filters && typeof result.filters === 'object' ? result.filters : {}

  return {
    answer: String(result.answer ?? '').trim() || `Showing results for “${searchTerm}”.`,
    searchTerm,
    filters: {
      minPrice:
        typeof filters.minPrice === 'number' && Number.isFinite(filters.minPrice)
          ? filters.minPrice
          : null,
      maxPrice:
        typeof filters.maxPrice === 'number' && Number.isFinite(filters.maxPrice)
          ? filters.maxPrice
          : null,
      listingType:
        filters.listingType === 'physical' || filters.listingType === 'digital'
          ? filters.listingType
          : null,
      category:
        typeof filters.category === 'string' && filters.category.trim()
          ? filters.category.trim()
          : null,
    },
    listingIds: Array.isArray(result.listingIds)
      ? result.listingIds.map((id) => String(id)).filter(Boolean).slice(0, 24)
      : [],
    deepLinks: Array.isArray(result.deepLinks) ? result.deepLinks : [],
    usedFallback: Boolean(result.usedFallback),
  }
}
