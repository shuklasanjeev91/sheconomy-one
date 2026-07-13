/**
 * Helpers for composing and encoding @mentions and #hashtags in community text
 * inputs (posts, comments, reposts). Mentions are shown to the author as a plain
 * `@Display Name` while typing, then encoded on submit to `@[Display Name](uuid)`
 * so they render as resolvable profile links everywhere.
 */

export type MentionRef = {
  id: string
  /** Display text without the leading `@` (e.g. "Archena S Agarwal"). */
  display: string
}

export type ActiveToken =
  | { type: 'mention'; query: string; start: number }
  | { type: 'hashtag'; query: string; start: number }

const WHITESPACE = /\s/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detect an in-progress mention/hashtag token at the end of `text` (the typing
 * position). Returns null when the caret is not inside a trigger token.
 */
export function getActiveToken(text: string): ActiveToken | null {
  let start = text.length
  while (start > 0 && !WHITESPACE.test(text[start - 1] ?? '')) start--

  const token = text.slice(start)
  if (!token) return null

  if (token[0] === '@') {
    const query = token.slice(1)
    // Skip already-encoded mentions like `@[Name](id)`.
    if (query.includes('[') || query.includes('(')) return null
    return { type: 'mention', query, start }
  }

  if (token[0] === '#') {
    return { type: 'hashtag', query: token.slice(1), start }
  }

  return null
}

/** Replace the active trigger token (at the end of the text) with `insertion`. */
export function replaceActiveToken(text: string, start: number, insertion: string): string {
  return `${text.slice(0, start)}${insertion} `
}

/**
 * Encode plain `@Display Name` mentions into `@[Display Name](uuid)` tokens so
 * they can be rendered as profile links. Only display names still present in the
 * text are encoded; longer names are processed first to avoid partial overlaps.
 */
export function encodeMentions(text: string, mentions: MentionRef[]): string {
  if (!text || mentions.length === 0) return text

  const unique = new Map<string, MentionRef>()
  for (const mention of mentions) {
    if (mention.id && mention.display) {
      unique.set(`${mention.id}::${mention.display}`, mention)
    }
  }

  const sorted = [...unique.values()].sort((a, b) => b.display.length - a.display.length)

  let output = text
  for (const mention of sorted) {
    const needle = `@${mention.display}`
    const token = `@[${mention.display}](${mention.id})`
    // Only replace when followed by a boundary so "@Ann" doesn't match "@Anna".
    const pattern = new RegExp(`${escapeRegExp(needle)}(?=$|[^\\w])`, 'g')
    output = output.replace(pattern, token)
  }

  return output
}

/** Convert encoded mentions back to `@Display Name` for plain-text contexts. */
export function mentionsToPlainText(text: string): string {
  if (!text) return text
  return text.replace(/@\[([^\]]+)\]\((?:user:)?[0-9a-fA-F-]{36}\)/g, '@$1')
}
