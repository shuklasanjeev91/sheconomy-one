/**
 * Detects the old hardcoded create-post template:
 * "Sharing a quick update on ${topic}… what’s resonating for you…"
 * Never treat this as a live SHERPA draft.
 */
export function isGenericFallbackDraft(draft: string | null | undefined): boolean {
  const body = draft?.trim() ?? ''
  if (!body) return false
  return (
    /^sharing a quick update on\b/i.test(body) ||
    (/a few things stood out for me as i.?ve been exploring this/i.test(body) &&
      /what.?s resonating for you/i.test(body)) ||
    (/i.?ve been thinking about\b/i.test(body) &&
      /what would you add from your experience/i.test(body)) ||
    (/excited to celebrate\b/i.test(body) && /who else is celebrating a win/i.test(body))
  )
}
