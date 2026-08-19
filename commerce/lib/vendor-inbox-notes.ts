import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_PREFIX = 'sheconomy:vendor-inbox-notes'

export const VENDOR_INBOX_PRESET_TAGS = [
  'customer_called',
  'awaiting_stock',
  'pickup_escalated',
  'high_value_buyer',
  'fragile_order',
  'watch_closely',
] as const

export type VendorInboxPresetTag = (typeof VENDOR_INBOX_PRESET_TAGS)[number]

export type VendorInboxContextEntry = {
  key: string
  orderItemId: string | null
  issueId: string | null
  orderId: string | null
  note: string
  tags: string[]
  updatedAt: number
}

export type VendorInboxRowRef = {
  id: string
  orderItemId: string | null
  issueId: string | null
  orderId: string | null
}

export type VendorInboxCoordination = {
  note: string | null
  tags: string[]
  updatedAt: number | null
}

function storageKey(shopId: string) {
  return `${STORAGE_PREFIX}:${shopId}`
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

export function vendorInboxContextKey(ref: VendorInboxRowRef) {
  if (ref.issueId) return `issue:${ref.issueId}`
  if (ref.orderItemId) return `item:${ref.orderItemId}`
  if (ref.orderId) return `order:${ref.orderId}`
  return `row:${ref.id}`
}

export async function readVendorInboxContextEntries(shopId: string): Promise<VendorInboxContextEntry[]> {
  if (!shopId) return []
  try {
    const raw = await AsyncStorage.getItem(storageKey(shopId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is VendorInboxContextEntry => {
        if (!entry || typeof entry !== 'object') return false
        const value = entry as Record<string, unknown>
        return typeof value.key === 'string' && typeof value.note === 'string' && Array.isArray(value.tags)
      })
      .map((entry) => ({
        ...entry,
        tags: normalizeTags(entry.tags),
      }))
  } catch {
    return []
  }
}

async function writeVendorInboxContextEntries(shopId: string, entries: VendorInboxContextEntry[]) {
  await AsyncStorage.setItem(storageKey(shopId), JSON.stringify(entries))
}

export async function saveVendorInboxContextEntry(
  shopId: string,
  ref: VendorInboxRowRef,
  draft: { note?: string; tags?: string[] },
) {
  if (!shopId) return
  const entries = await readVendorInboxContextEntries(shopId)
  const key = vendorInboxContextKey(ref)
  const note = draft.note?.trim() ?? ''
  const tags = normalizeTags(draft.tags ?? [])
  const nextEntry: VendorInboxContextEntry = {
    key,
    orderItemId: ref.orderItemId,
    issueId: ref.issueId,
    orderId: ref.orderId,
    note,
    tags,
    updatedAt: Date.now(),
  }

  const nextEntries = entries.filter((entry) => entry.key !== key)
  if (note || tags.length) nextEntries.unshift(nextEntry)
  await writeVendorInboxContextEntries(shopId, nextEntries)
}

export async function applyVendorInboxContextBatch(
  shopId: string,
  rows: VendorInboxRowRef[],
  draft: { note?: string; tags?: string[] },
) {
  if (!shopId || !rows.length) return
  const entries = await readVendorInboxContextEntries(shopId)
  const byKey = new Map(entries.map((entry) => [entry.key, entry]))
  const note = draft.note?.trim()
  const tagsToAdd = normalizeTags(draft.tags ?? [])

  for (const row of rows) {
    const key = vendorInboxContextKey(row)
    const current = byKey.get(key)
    const merged: VendorInboxContextEntry = {
      key,
      orderItemId: row.orderItemId,
      issueId: row.issueId,
      orderId: row.orderId,
      note: note && note.length > 0 ? note : current?.note ?? '',
      tags: normalizeTags([...(current?.tags ?? []), ...tagsToAdd]),
      updatedAt: Date.now(),
    }
    if (merged.note || merged.tags.length) byKey.set(key, merged)
  }

  await writeVendorInboxContextEntries(shopId, [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt))
}

export function mergeVendorInboxContext<T extends VendorInboxRowRef & { tags: string[] }>(
  rows: T[],
  entries: VendorInboxContextEntry[],
): Array<T & { internalNote: string | null; internalTags: string[]; updatedAt: number | null }> {
  const entryByKey = new Map(entries.map((entry) => [entry.key, entry]))
  return rows.map((row) => {
    const entry = entryByKey.get(vendorInboxContextKey(row)) ?? null
    const internalTags = entry?.tags ?? []
    return {
      ...row,
      tags: normalizeTags([...row.tags, ...internalTags]),
      internalNote: entry?.note || null,
      internalTags,
      updatedAt: entry?.updatedAt ?? null,
    }
  })
}

export function resolveVendorInboxContext(
  entries: VendorInboxContextEntry[],
  ref: { issueId?: string | null; orderItemId?: string | null; orderId?: string | null },
): VendorInboxCoordination {
  const entry =
    entries.find((current) => ref.issueId && current.issueId === ref.issueId) ??
    entries.find((current) => ref.orderItemId && current.orderItemId === ref.orderItemId) ??
    entries.find((current) => ref.orderId && current.orderId === ref.orderId) ??
    null

  return {
    note: entry?.note || null,
    tags: entry?.tags ?? [],
    updatedAt: entry?.updatedAt ?? null,
  }
}
