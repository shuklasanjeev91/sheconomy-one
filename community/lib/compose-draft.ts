import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'sheconomy:compose-draft'

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
  const payload: ComposeDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export async function loadComposeDraft(): Promise<ComposeDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ComposeDraft
    if (!parsed || typeof parsed.content !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export async function clearComposeDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
}
