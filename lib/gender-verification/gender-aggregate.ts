import type { GenderEstimate } from '~/lib/gender-verification/constants'

/**
 * Aggregate the per-frame gender estimates collected during a verification run.
 *
 * On-device models report a label plus the confidence of *that* label, and the
 * label itself flips between frames as lighting, head angle, and blinks change.
 * Deciding from one frame therefore rejects real women at random. We convert
 * every sample to a female probability, drop the two most extreme frames, and
 * judge the mean — one bad frame can no longer decide the outcome.
 */
export type GenderSample = GenderEstimate

export type GenderVerdictStatus = 'pass' | 'insufficient' | 'fail'

export type GenderVerdict = {
  status: GenderVerdictStatus
  /** Trimmed mean female probability, or null when there was nothing to score. */
  femaleScore: number | null
  /** Share of samples whose label was female. */
  femaleRatio: number
  samples: number
}

export type GenderVerdictOptions = {
  /** Below this many usable samples we ask for more frames instead of judging. */
  minSamples: number
  /** Mean female probability required to pass. Mirrored by the Supabase RPC. */
  threshold: number
  /** How far under the threshold still counts as worth another sampling round. */
  borderlineBand: number
  /** Source face width required for a reliable description-model read. */
  minFacePixels?: number
}

/** Confidence is for the predicted label, so a male sample inverts to female. */
export function femaleProbability(sample: GenderSample): number {
  const confidence = Math.min(1, Math.max(0, sample.confidence))
  return sample.isFemale ? confidence : 1 - confidence
}

function isUsable(
  sample: GenderSample | null | undefined,
  minFacePixels: number,
): sample is GenderSample {
  return (
    !!sample &&
    Number.isFinite(sample.confidence) &&
    (sample.facePixels == null || sample.facePixels >= minFacePixels)
  )
}

/** Drop the single lowest and highest probability once there are enough samples. */
function trim(values: number[]): number[] {
  if (values.length < 5) return values
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.slice(1, sorted.length - 1)
}

export function summarizeGenderSamples(
  samples: readonly (GenderSample | null | undefined)[],
  options: GenderVerdictOptions,
): GenderVerdict {
  const usable = samples.filter((sample) => isUsable(sample, options.minFacePixels ?? 0))

  if (usable.length === 0) {
    return { status: 'insufficient', femaleScore: null, femaleRatio: 0, samples: 0 }
  }

  const probabilities = usable.map(femaleProbability)
  const kept = trim(probabilities)
  const femaleScore = Number(
    (kept.reduce((sum, value) => sum + value, 0) / kept.length).toFixed(3),
  )
  const femaleRatio = usable.filter((sample) => sample.isFemale).length / usable.length

  if (usable.length < options.minSamples) {
    return { status: 'insufficient', femaleScore, femaleRatio, samples: usable.length }
  }

  // A confident mean still needs the labels to agree, so a handful of very
  // high-confidence frames cannot outvote a mostly-male read.
  if (femaleScore >= options.threshold && femaleRatio >= 0.5) {
    return { status: 'pass', femaleScore, femaleRatio, samples: usable.length }
  }

  if (femaleScore >= options.threshold - options.borderlineBand) {
    return { status: 'insufficient', femaleScore, femaleRatio, samples: usable.length }
  }

  return { status: 'fail', femaleScore, femaleRatio, samples: usable.length }
}
