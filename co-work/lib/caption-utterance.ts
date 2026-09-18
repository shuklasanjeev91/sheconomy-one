/**
 * Merge Android/iOS STT partials into a growing utterance.
 *
 * Google SpeechRecognizer often ends after each short pause and may emit
 * partials that are only the newest word — without merging, the overlay
 * shows a single word while the person keeps speaking.
 */
export function mergeCaptionHypothesis(previous: string, next: string): string {
  const prev = previous.trim()
  const incoming = next.trim()
  if (!incoming) return prev
  if (!prev) return incoming

  const prevLower = prev.toLowerCase()
  const nextLower = incoming.toLowerCase()

  // Full replacement / extension of the same hypothesis.
  if (nextLower.startsWith(prevLower) || nextLower.includes(prevLower)) {
    return incoming
  }
  // Engine restarted mid-phrase with only the newest token(s).
  if (prevLower.endsWith(nextLower) || prevLower.includes(nextLower)) {
    return prev
  }

  const prevWords = prev.split(/\s+/).filter(Boolean)
  const nextWords = incoming.split(/\s+/).filter(Boolean)
  // Overlap suffix/prefix (e.g. "hello how" + "how are you" → "hello how are you").
  const maxOverlap = Math.min(prevWords.length, nextWords.length)
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const suffix = prevWords.slice(-size).join(' ').toLowerCase()
    const prefix = nextWords.slice(0, size).join(' ').toLowerCase()
    if (suffix === prefix) {
      return [...prevWords, ...nextWords.slice(size)].join(' ')
    }
  }

  return `${prev} ${incoming}`.replace(/\s+/g, ' ').trim()
}

/** True when the recognizer likely finished a short fragment, not a full sentence. */
export function isLikelyCaptionFragment(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return true
  if (/[,:;]$/.test(trimmed)) return true
  if (!/[.!?…]["')\]]*$/.test(trimmed) && words.length < 8) return true
  return false
}
