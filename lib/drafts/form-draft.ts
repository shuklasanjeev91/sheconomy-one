import AsyncStorage from '@react-native-async-storage/async-storage'

import { DRAFT_DEFAULT_TTL_MS, isDraftFresh } from '~/lib/drafts/draft-freshness'

const PREFIX = 'sheconomy:form-draft:'
const DEFAULT_TTL_MS = DRAFT_DEFAULT_TTL_MS

export { isDraftFresh }

export type FormDraftEnvelope<T> = {
  data: T
  updatedAt: string
  version?: number
}

function storageKey(key: string) {
  return `${PREFIX}${key}`
}

export async function saveFormDraft<T>(
  key: string,
  data: T,
  options?: { version?: number },
): Promise<void> {
  const envelope: FormDraftEnvelope<T> = {
    data,
    updatedAt: new Date().toISOString(),
    version: options?.version,
  }
  await AsyncStorage.setItem(storageKey(key), JSON.stringify(envelope))
}

export async function loadFormDraft<T>(
  key: string,
  options?: { maxAgeMs?: number; version?: number },
): Promise<FormDraftEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FormDraftEnvelope<T>
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null

    if (options?.version != null && parsed.version != null && parsed.version !== options.version) {
      await clearFormDraft(key)
      return null
    }

    const maxAge = options?.maxAgeMs ?? DEFAULT_TTL_MS
    if (!isDraftFresh(parsed.updatedAt, maxAge)) {
      await clearFormDraft(key)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function clearFormDraft(key: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(key)).catch(() => {})
}
