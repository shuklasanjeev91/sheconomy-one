import { supabase } from '~/lib/supabase'

import type {
  AiFeedbackParams,
  AiSuggestion,
  CommentSuggestionParams,
  FetchAiSuggestionsParams,
  MeetingDraftParams,
  MeetingDraftResult,
  PostDraftParams,
  PostDraftResult,
  SendAiMessageParams,
  SendAiMessageResult,
} from './types'

type InvokeErrorPayload = {
  error?: string
}

async function invokeAiAssist<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body })

  if (error) {
    const message =
      (data as InvokeErrorPayload | null)?.error ||
      error.message ||
      'SHEconomy AI is unavailable right now.'
    throw new Error(message)
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
    context: params.context ?? {},
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
