/**
 * Merge Android/iOS STT partials into a growing utterance.
 *
 * Google SpeechRecognizer often ends after each short pause and may emit
 * partials that are only the newest word — without merging, the overlay
 * shows a single word while the person keeps speaking.
 *
 * Also guards against echo loops that concatenate the same phrase forever
 * ("Hello hello How are you" × N).
 */
export function mergeCaptionHypothesis(previous: string, next: string): string {
  const prev = previous.trim()
  const incoming = next.trim()
  if (!incoming) return prev
  if (!prev) return incoming

  const prevLower = prev.toLowerCase()
  const nextLower = incoming.toLowerCase()
  const prevWords = prev.split(/\s+/).filter(Boolean)
  const nextWords = incoming.split(/\s+/).filter(Boolean)

  // Fresh restart only when a longer phrase clearly restarts (avoid dropping
  // "how are you…" when partials briefly shorten).
  if (
    prevWords.length >= 12 &&
    nextWords.length >= 4 &&
    nextWords.length < prevWords.length * 0.5 &&
    nextWords[0]!.toLowerCase() === prevWords[0]!.toLowerCase()
  ) {
    return trimCaptionUtterance(incoming)
  }

  // Full replacement / extension of the same hypothesis.
  if (nextLower.startsWith(prevLower) || nextLower.includes(prevLower)) {
    return trimCaptionUtterance(incoming)
  }
  // Engine restarted mid-phrase with only the newest token(s).
  if (prevLower.endsWith(nextLower) || prevLower.includes(nextLower)) {
    return trimCaptionUtterance(prev)
  }

  // Overlap suffix/prefix (e.g. "hello how" + "how are you" → "hello how are you").
  const maxOverlap = Math.min(prevWords.length, nextWords.length)
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const suffix = prevWords.slice(-size).join(' ').toLowerCase()
    const prefix = nextWords.slice(0, size).join(' ').toLowerCase()
    if (suffix === prefix) {
      return trimCaptionUtterance([...prevWords, ...nextWords.slice(size)].join(' '))
    }
  }

  return trimCaptionUtterance(`${prev} ${incoming}`)
}

/** Collapse repeated cycles and cap runaway STT growth. */
export function trimCaptionUtterance(text: string, maxWords = 28): string {
  let words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return ''

  let changed = true
  while (changed && words.length >= 6) {
    changed = false
    for (let len = Math.floor(words.length / 2); len >= 3; len -= 1) {
      for (let index = 0; index + len * 2 <= words.length; index += 1) {
        const left = words.slice(index, index + len).join(' ').toLowerCase()
        const right = words.slice(index + len, index + len * 2).join(' ').toLowerCase()
        if (left && left === right) {
          words = [...words.slice(0, index + len), ...words.slice(index + len * 2)]
          changed = true
          break
        }
      }
      if (changed) break
    }
  }

  if (words.length <= maxWords) return words.join(' ')
  return words.slice(-maxWords).join(' ')
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
