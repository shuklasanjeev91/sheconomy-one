/**
 * Active-speaker selection for Speaker view.
 *
 * Uses LiveKit audio levels with sticky hysteresis so the main tile does not
 * flicker between participants on short noise spikes.
 */

export type ActiveSpeakerCandidate = {
  identity: string
  audioLevel: number
  isSpeaking: boolean
}

export type ResolveActiveSpeakerOptions = {
  candidates: ActiveSpeakerCandidate[]
  previousIdentity?: string | null
  /** Minimum audio level to consider someone "speaking". */
  speakThreshold?: number
  /** How much louder a challenger must be to steal focus (0–1 scale). */
  switchMargin?: number
}

/**
 * Pick the loudest current speaker, but keep the previous identity while they
 * are still audible and nobody else is clearly louder.
 */
export function resolveActiveSpeakerIdentity(
  options: ResolveActiveSpeakerOptions,
): string | null {
  const speakThreshold = options.speakThreshold ?? 0.04
  const switchMargin = options.switchMargin ?? 0.12
  const previous = options.previousIdentity ?? null

  const audible = options.candidates
    .filter(
      (candidate) =>
        candidate.isSpeaking || candidate.audioLevel >= speakThreshold,
    )
    .sort((left, right) => {
      if (right.audioLevel !== left.audioLevel) {
        return right.audioLevel - left.audioLevel
      }
      // Prefer explicit isSpeaking when levels tie.
      return Number(right.isSpeaking) - Number(left.isSpeaking)
    })

  if (audible.length === 0) {
    // Silence — keep the last focused speaker so the stage does not jump.
    if (previous && options.candidates.some((c) => c.identity === previous)) {
      return previous
    }
    return options.candidates[0]?.identity ?? null
  }

  const top = audible[0]!
  if (!previous || previous === top.identity) return top.identity

  const previousStillAudible = audible.find((c) => c.identity === previous)
  if (
    previousStillAudible &&
    top.audioLevel < previousStillAudible.audioLevel + switchMargin
  ) {
    return previous
  }

  return top.identity
}

/** Ordered unique identities from LiveKit ActiveSpeakersChanged payloads. */
export function identitiesFromActiveSpeakers(
  speakers: Array<{ identity?: string | null }>,
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const speaker of speakers) {
    const identity = speaker.identity?.trim()
    if (!identity || seen.has(identity)) continue
    seen.add(identity)
    ordered.push(identity)
  }
  return ordered
}
