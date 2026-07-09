export const POST_TRUNCATE_LENGTH = 280

const TOKEN_REGEX = /(#([\w\u00C0-\u024F]+)|@([\w.]+))/g

export type PostTextSegment =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string; tag: string }
  | { type: 'mention'; value: string; handle: string }

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

    if (match[2]) {
      segments.push({ type: 'hashtag', value: match[1], tag: match[2] })
    } else if (match[3]) {
      segments.push({ type: 'mention', value: match[1], handle: match[3] })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}
