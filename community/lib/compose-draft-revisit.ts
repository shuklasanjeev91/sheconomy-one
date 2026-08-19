import type { ComposeDraft } from '~/community/lib/compose-draft'
import { loadComposeDraft } from '~/community/lib/compose-draft'
import { communityRoutes } from '~/lib/routes'

export type ComposeDraftRevisitCard = {
  headline: string
  detail: string
  preview: string
  href: string
  updatedAt: string
}

const PREVIEW_MAX = 120

function truncatePreview(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= PREVIEW_MAX) return trimmed
  return `${trimmed.slice(0, PREVIEW_MAX - 1).trim()}…`
}

export function buildComposeDraftRevisitCard(
  draft: ComposeDraft | null,
): ComposeDraftRevisitCard | null {
  if (!draft) return null

  const content = draft.content?.trim() ?? ''
  const title = draft.articleTitle?.trim() ?? ''
  if (!content && !title) return null

  const preview = title ? truncatePreview(title) : truncatePreview(content)
  const modeLabel =
    draft.mode === 'article' ? 'article' : draft.mode === 'poll' ? 'poll' : 'post'

  return {
    headline: 'Finish your draft',
    detail: `You started a ${modeLabel} — pick up where you left off.`,
    preview,
    href: String(communityRoutes.createPost),
    updatedAt: draft.updatedAt,
  }
}

export async function fetchComposeDraftRevisitCard(): Promise<{
  card: ComposeDraftRevisitCard | null
  error: string | null
}> {
  try {
    const draft = await loadComposeDraft()
    return { card: buildComposeDraftRevisitCard(draft), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load draft'
    return { card: null, error: message }
  }
}

export function composeDraftRevisitHref() {
  return communityRoutes.createPost
}
