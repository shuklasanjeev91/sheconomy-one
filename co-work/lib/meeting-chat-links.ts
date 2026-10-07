export type MeetingChatTextPart =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; url: string }

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi
const TRAILING_PUNCTUATION_RE = /[),.;:!?]+$/

export function parseMeetingChatTextLinks(text: string): MeetingChatTextPart[] {
  if (!text) return []

  const parts: MeetingChatTextPart[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0]
    const start = match.index ?? 0
    const trailing = raw.match(TRAILING_PUNCTUATION_RE)?.[0] ?? ''
    const label = trailing ? raw.slice(0, -trailing.length) : raw

    if (!label) continue
    if (start > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, start) })
    }

    parts.push({
      type: 'link',
      text: label,
      url: label.startsWith('www.') ? `https://${label}` : label,
    })

    if (trailing) {
      parts.push({ type: 'text', text: trailing })
    }
    lastIndex = start + raw.length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text', text }]
}
