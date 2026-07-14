import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'sheconomy:chat-message-drafts'
const MAX_CONVERSATIONS = 40

type DraftMap = Record<string, string>

async function readAll(): Promise<DraftMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
    )
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

async function writeAll(map: DraftMap) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/** Load a per-conversation composer draft (web + iOS + Android). */
export async function loadMessageDraft(conversationId: string): Promise<string> {
  if (!conversationId) return ''
  const map = await readAll()
  return map[conversationId]?.trim() ? map[conversationId] : ''
}

/** Persist (or clear) a per-conversation composer draft. */
export async function saveMessageDraft(conversationId: string, text: string): Promise<void> {
  if (!conversationId) return
  const map = await readAll()
  const trimmed = text.trim()
  if (!trimmed) {
    if (!(conversationId in map)) return
    delete map[conversationId]
    await writeAll(map)
    return
  }

  const rest = Object.entries(map).filter(([id]) => id !== conversationId)
  const orderedEntries: Array<[string, string]> = [[conversationId, text], ...rest]
  await writeAll(Object.fromEntries(orderedEntries.slice(0, MAX_CONVERSATIONS)))
}

export async function clearMessageDraft(conversationId: string): Promise<void> {
  await saveMessageDraft(conversationId, '')
}
