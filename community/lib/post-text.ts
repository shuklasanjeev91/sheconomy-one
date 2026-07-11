export const POST_TRUNCATE_LENGTH = 280

// Matches, in order of priority:
//  1. Encoded mention  `@[Display Name](uuid)` — carries a resolvable user id
//  2. Hashtag          `#topic`
//  3. Legacy mention   `@handle`
const MENTION_TOKEN = '@\\[([^\\]]+)\\]\\((?:user:)?([0-9a-fA-F-]{36})\\)'
const HASHTAG_TOKEN = '#([\\w\\u00C0-\\u024F]+)'
const LEGACY_MENTION_TOKEN = '@([\\w.]+)'
const TOKEN_REGEX = new RegExp(
  `${MENTION_TOKEN}|${HASHTAG_TOKEN}|${LEGACY_MENTION_TOKEN}`,
  'g',
)

export type PostTextSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; tag: string }
  | { type: 'mention'; value: string; handle: string }

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X'
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return match
        }
      }
      return match
    }
    const decoded = HTML_ENTITIES[entity.toLowerCase()]
    return decoded ?? match
  })
}

/**
 * Convert stored rich-text/HTML content into readable plain text. Posts and
 * comments may contain markup like `<br>`, `<p>`, `<div>`, `<li>` and HTML
 * entities that would otherwise render as raw tags. Block-level tags and line
 * breaks become newlines (preserved via `white-space: pre-wrap`), list items get
 * a bullet, all other tags are stripped, and entities are decoded.
 */
export function htmlToPlainText(content: string): string {
  if (!content) return ''
  if (!/[<&]/.test(content)) return content

  let text = content
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, '')

  text = decodeHtmlEntities(text)

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function extractHashtags(content: string): string[] {
  const matches = content.match(/#([\w\u00C0-\u024F]+)/g) ?? []
  return [...new Set(matches.map((token) => token.slice(1).toLowerCase()))]
}

export function extractMentions(content: string): string[] {
  const matches = content.match(/@([\w.]+)/g) ?? []
  return [...new Set(matches.map((token) => token.slice(1)))]
}

export function shouldTruncatePost(content: string, maxLength = POST_TRUNCATE_LENGTH) {
  return content.length > maxLength
}

export function truncatePost(content: string, maxLength = POST_TRUNCATE_LENGTH) {
  if (content.length <= maxLength) return content

  const cut = content.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = (lastSpace > maxLength * 0.7 ? cut.slice(0, lastSpace) : cut).trimEnd()
  return `${trimmed}…`
}

export function parsePostText(content: string): PostTextSegment[] {
  if (!content) return []

  const segments: PostTextSegment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(TOKEN_REGEX)) {
    const index = match.index ?? 0

    if (index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, index) })
    }

    const [, mentionDisplay, mentionId, hashtag, legacyHandle] = match

    if (mentionDisplay && mentionId) {
      // Encoded mention — show the display name, link to the resolvable id.
      segments.push({ type: 'mention', value: mentionDisplay, handle: mentionId })
    } else if (hashtag) {
      segments.push({ type: 'hashtag', value: `#${hashtag}`, tag: hashtag })
    } else if (legacyHandle) {
      segments.push({ type: 'mention', value: `@${legacyHandle}`, handle: legacyHandle })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}
