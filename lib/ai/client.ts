import { invokeOwnedAssist } from '~/lib/ai/owned-service'

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
  PostSuggestionChip,
  WritingIssue,
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

async function invokeAiAssist<T>(body: Record<string, unknown>): Promise<T> {
  const owned = await invokeOwnedAssist<T>(body)
  if (!owned) {
    throw new Error('SHERPA is unavailable right now.')
  }
  return owned
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
    throw new Error('Empty response from SHERPA.')
  }

  return {
    ...result,
    deepLinks: Array.isArray(result.deepLinks) ? result.deepLinks : [],
    listingIds: Array.isArray(result.listingIds)
      ? result.listingIds.map((id) => String(id)).filter(Boolean).slice(0, 4)
      : [],
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

/** Short lines for the open chat: a greeting, or a reply to the latest message. */
export async function fetchChatSuggestions(params: {
  peerName?: string | null
  latestMessage?: string | null
}): Promise<string[]> {
  const result = await invokeAiAssist<{ suggestions?: string[] }>({
    action: 'chat_suggestions',
    product: 'chat',
    context: {
      peer_name: params.peerName?.trim() || null,
      latest_message: params.latestMessage?.trim() || null,
    },
  })
  if (!result || !Array.isArray(result.suggestions)) return []
  return result.suggestions.map((line) => String(line).trim()).filter(Boolean).slice(0, 3)
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
      image_url: params.imageUrl ?? null,
      has_video: Boolean(params.hasVideo),
      parent_comment: params.parentComment ?? null,
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

/** Short original post starters for the composer. Empty when SHERPA has none. */
export async function fetchPostSuggestions(params?: {
  mode?: string | null
  memberName?: string | null
  headline?: string | null
  location?: string | null
}): Promise<PostSuggestionChip[]> {
  const result = await invokeAiAssist<{ suggestions?: PostSuggestionChip[] }>({
    action: 'post_suggestions',
    product: 'community',
    context: {
      compose_mode: params?.mode ?? 'text',
      member_name: params?.memberName ?? null,
      headline: params?.headline ?? null,
      location: params?.location ?? null,
    },
  })
  if (!Array.isArray(result.suggestions)) return []
  return result.suggestions
    .map((row) => ({
      label: String(row?.label ?? '').trim(),
      draft: String(row?.draft ?? '').trim(),
    }))
    .filter((row) => row.label && row.draft)
    .slice(0, 4)
}

/** Spell and grammar issues for a sentence the member is still editing. */
export async function fetchWritingIssues(text: string): Promise<WritingIssue[]> {
  const result = await invokeAiAssist<{ issues?: WritingIssue[] }>({
    action: 'writing_check',
    product: 'community',
    message: text,
  })
  if (!Array.isArray(result.issues)) return []
  return result.issues
    .map((row) => ({
      start: Number(row?.start),
      end: Number(row?.end),
      type: row?.type === 'grammar' ? ('grammar' as const) : ('spelling' as const),
      message: String(row?.message ?? '').trim(),
      suggestions: Array.isArray(row?.suggestions)
        ? row.suggestions.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [],
    }))
    .filter(
      (row) =>
        Number.isFinite(row.start) &&
        Number.isFinite(row.end) &&
        row.end > row.start &&
        row.end <= text.length &&
        row.suggestions.length > 0,
    )
    .slice(0, 8)
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
  let result: ListingDraftFromImageResult
  try {
    result = await invokeAiAssist<ListingDraftFromImageResult>({
      action: 'listing_draft_from_image',
      product: 'commerce',
      message: params.dataUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/sign in/i.test(message)) throw error instanceof Error ? error : new Error(message)
    if (/too large/i.test(message)) throw new Error('That photo is too large. Use a smaller image.')
    if (/add a product photo/i.test(message)) throw new Error('Add a product photo first.')
    throw new Error("Couldn't read this photo. Try a clearer product picture.")
  }

  const title = String(result.title ?? '').trim()
  const description = String(result.description ?? '').trim()
  if (!title || !description) {
    throw new Error("Couldn't read this photo. Try a clearer product picture.")
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
    priceNote: String(result.priceNote ?? '').trim(),
    categoryHint:
      typeof result.categoryHint === 'string' && result.categoryHint.trim()
        ? result.categoryHint.trim()
        : null,
    metaTitle: String(result.metaTitle ?? '').trim().slice(0, 60),
    metaDescription: String(result.metaDescription ?? '').trim().slice(0, 160),
    usedFallback: Boolean(result.usedFallback),
  }
}

/** Natural-language product search with structured filters + listing hits. */
export async function searchWithAi(params: AiSearchParams): Promise<AiSearchResult> {
  const location = params.location?.trim()
  const result = await invokeAiAssist<AiSearchResult>({
    action: 'ai_search',
    product: 'commerce',
    message: params.message,
    ...(location ? { context: { location } } : {}),
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
    groups: Array.isArray(result.groups)
      ? result.groups
          .map((group) => ({
            label: String(group?.label ?? '').trim(),
            listingIds: Array.isArray(group?.listingIds)
              ? group.listingIds.map((id) => String(id)).filter(Boolean).slice(0, 8)
              : [],
          }))
          .filter((group) => group.label && group.listingIds.length > 0)
      : [],
    resultKind: (
      [
        'listing',
        'person',
        'shop',
        'job',
        'program',
        'post',
        'company',
        'event',
        'meeting',
        'help',
      ] as const
    ).includes(result.resultKind)
      ? result.resultKind
      : 'listing',
    entityIds: Array.isArray(result.entityIds)
      ? result.entityIds.map((id) => String(id)).filter(Boolean).slice(0, 24)
      : [],
    hits: Array.isArray(result.hits)
      ? result.hits
          .map((hit) => ({
            id: String(hit?.id ?? ''),
            kind: String(hit?.kind ?? ''),
            title: String(hit?.title ?? ''),
            subtitle: String(hit?.subtitle ?? ''),
            href: String(hit?.href ?? ''),
          }))
          .filter((hit) => hit.id && hit.title && hit.href)
          .slice(0, 24)
      : [],
    deepLinks: Array.isArray(result.deepLinks) ? result.deepLinks : [],
    usedFallback: Boolean(result.usedFallback),
  }
}
