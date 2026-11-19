import { extractHashtags } from '~/community/lib/post-text'

/** Keep hashtags the member typed; append any that the model dropped. */
export function mergeMemberHashtags(content: string, seed: string | null | undefined): string {
  const body = content.trim()
  if (!body) return body
  const memberTags = extractHashtags(seed ?? '')
  if (!memberTags.length) return body

  const existing = new Set(extractHashtags(body))
  const missing = memberTags.filter((tag) => !existing.has(tag))
  if (!missing.length) return body

  return `${body}\n\n${missing.map((tag) => `#${tag}`).join(' ')}`
}

/** Pull the research topic from free-text compose notes / “write about X”. */
export function extractTopicFromComposeNotes(seed: string | null | undefined): string {
  const raw = (seed ?? '').trim()
  if (!raw) return ''
  const cleaned = raw
    .replace(/^write (a |an |the )?(post |update )?(about|on|regarding)\s+/i, '')
    .replace(/^write about\s+/i, '')
    .replace(/^about\s+/i, '')
    .replace(/#[\w\u00C0-\u024F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 160)
}

/** Derive a short Giphy query from member notes when the model omits gifQuery. */
export function deriveGifQueryFromSeed(seed: string | null | undefined): string {
  const topic = extractTopicFromComposeNotes(seed)
  if (!topic) return 'women empowerment'
  const words = topic
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 4)
  return words.join(' ') || 'women empowerment'
}
