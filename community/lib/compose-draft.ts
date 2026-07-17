import { clearFormDraft, loadFormDraft, saveFormDraft } from '~/lib/drafts/form-draft'

const DRAFT_KEY = 'community-compose'

export type ComposeDraft = {
  content: string
  articleTitle?: string
  mode?: string
  updatedAt: string
}

/** Persist an in-progress community post draft across web / iOS / Android. */
export async function saveComposeDraft(draft: Omit<ComposeDraft, 'updatedAt'>): Promise<void> {
  const content = draft.content.trim()
  if (!content && !draft.articleTitle?.trim()) {
    await clearComposeDraft()
    return
  }
  await saveFormDraft(DRAFT_KEY, {
    content: draft.content,
    articleTitle: draft.articleTitle,
    mode: draft.mode,
  })
}

export async function loadComposeDraft(): Promise<ComposeDraft | null> {
  const envelope = await loadFormDraft<{
    content: string
    articleTitle?: string
    mode?: string
  }>(DRAFT_KEY)
  if (!envelope) return null
  if (typeof envelope.data.content !== 'string') return null
  return {
    content: envelope.data.content,
    articleTitle: envelope.data.articleTitle,
    mode: envelope.data.mode,
    updatedAt: envelope.updatedAt,
  }
}

export async function clearComposeDraft(): Promise<void> {
  await clearFormDraft(DRAFT_KEY)
}
