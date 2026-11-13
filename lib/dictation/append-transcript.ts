/**
 * Join existing field text with a speech transcript, inserting a space when needed.
 */
export function appendTranscript(base: string, transcript: string): string {
  const spoken = transcript.trim()
  if (!spoken) return base
  const left = base
  if (!left) return spoken
  if (/\s$/.test(left) || /^[.,!?;:]/.test(spoken)) return `${left}${spoken}`
  return `${left} ${spoken}`
}

/**
 * Replace an interim suffix after a committed base while speech is still flowing.
 */
export function withInterimTranscript(base: string, interim: string): string {
  return appendTranscript(base, interim)
}
