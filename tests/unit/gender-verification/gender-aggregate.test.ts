import { describe, expect, it } from 'vitest'

import {
  GENDER_ERROR_CODES,
  GENDER_ERROR_MESSAGES,
  classifyGenderError,
  getGenderErrorInstruction,
  isSoftRetryableGenderError,
} from '~/lib/gender-verification/errors'
import {
  femaleProbability,
  summarizeGenderSamples,
  type GenderSample,
} from '~/lib/gender-verification/gender-aggregate'
import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'

const OPTIONS = { minSamples: 4, threshold: 0.6, borderlineBand: 0.08 }

const female = (confidence: number): GenderSample => ({ isFemale: true, confidence })
const male = (confidence: number): GenderSample => ({ isFemale: false, confidence })

/**
 * Mirror of the server pass rule in
 * `complete_gender_verification_session` — kept here so a client-side "pass"
 * can be checked against the exact bar the RPC enforces.
 */
function serverWouldVerify(input: {
  detectedBlinks: number
  livenessScore: number
  genderDetected: boolean
  genderConfidence: number
}): boolean {
  return (
    input.detectedBlinks >= GENDER_VERIFICATION.requiredBlinks &&
    input.livenessScore >= GENDER_VERIFICATION.minLivenessScore &&
    input.genderDetected === true &&
    input.genderConfidence >= GENDER_VERIFICATION.minGenderConfidence
  )
}

describe('femaleProbability', () => {
  it('reads a male label as the inverse female probability', () => {
    expect(femaleProbability(female(0.8))).toBe(0.8)
    expect(femaleProbability(male(0.8))).toBeCloseTo(0.2, 5)
  })
})

describe('summarizeGenderSamples', () => {
  it('passes a woman whose run included a stray male frame', () => {
    const verdict = summarizeGenderSamples(
      [female(0.82), female(0.78), male(0.55), female(0.71), female(0.86), female(0.69)],
      OPTIONS,
    )

    expect(verdict.status).toBe('pass')
    expect(verdict.femaleScore).toBeCloseTo(0.75, 3)
    expect(verdict.samples).toBe(6)
  })

  it('discards one extreme frame instead of letting it decide the run', () => {
    const samples = [female(0.7), female(0.72), female(0.74), female(0.71), male(0.99)]
    const untrimmedMean =
      samples.reduce((sum, sample) => sum + femaleProbability(sample), 0) / samples.length

    expect(untrimmedMean).toBeLessThan(OPTIONS.threshold)
    expect(summarizeGenderSamples(samples, OPTIONS).status).toBe('pass')
  })

  it('asks for more frames when there are too few reads to judge', () => {
    const verdict = summarizeGenderSamples([female(0.9), female(0.88), female(0.91)], OPTIONS)

    expect(verdict.status).toBe('insufficient')
    expect(verdict.samples).toBe(3)
  })

  it('asks for more frames on a borderline mean rather than rejecting', () => {
    const verdict = summarizeGenderSamples(
      [female(0.55), female(0.58), female(0.56), female(0.57)],
      OPTIONS,
    )

    expect(verdict.status).toBe('insufficient')
    expect(verdict.femaleScore).toBeCloseTo(0.565, 3)
  })

  it('fails a clearly male run', () => {
    const verdict = summarizeGenderSamples([male(0.92), male(0.9), male(0.94), male(0.91)], OPTIONS)

    expect(verdict.status).toBe('fail')
    expect(verdict.femaleRatio).toBe(0)
  })

  it('does not pass when the labels are mostly male, however confident the rest', () => {
    const verdict = summarizeGenderSamples(
      [female(1), female(1), female(1), male(0.6), male(0.6), male(0.6), male(0.6)],
      OPTIONS,
    )

    expect(verdict.femaleScore).toBeGreaterThanOrEqual(OPTIONS.threshold)
    expect(verdict.status).not.toBe('pass')
  })

  it('ignores unusable reads and reports nothing to score', () => {
    const verdict = summarizeGenderSamples([null, undefined, { isFemale: true, confidence: NaN }], OPTIONS)

    expect(verdict.status).toBe('insufficient')
    expect(verdict.femaleScore).toBeNull()
    expect(verdict.samples).toBe(0)
  })

  it('ignores gender reads whose source face is too small to judge', () => {
    const verdict = summarizeGenderSamples(
      [
        { ...female(0.95), facePixels: 54 },
        { ...female(0.92), facePixels: 72 },
        { ...female(0.84), facePixels: 130 },
        { ...female(0.82), facePixels: 142 },
        { ...female(0.8), facePixels: 150 },
        { ...female(0.79), facePixels: 128 },
      ],
      { ...OPTIONS, minFacePixels: 96 },
    )

    expect(verdict.status).toBe('pass')
    expect(verdict.samples).toBe(4)
  })
})

describe('unclear-read failure copy', () => {
  it('classifies the retry guidance as retryable, not as not-eligible', () => {
    const code = classifyGenderError(
      new Error(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY]),
    )

    expect(code).toBe(GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY)
  })

  it('still classifies the women-only copy as not eligible', () => {
    const code = classifyGenderError(
      new Error(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.NOT_ELIGIBLE]),
    )

    expect(code).toBe(GENDER_ERROR_CODES.NOT_ELIGIBLE)
  })

  it('soft-retries lighting and face failures but never eligibility', () => {
    expect(isSoftRetryableGenderError(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY])).toBe(
      true,
    )
    expect(isSoftRetryableGenderError(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.LIVENESS_FAILED])).toBe(
      true,
    )
    expect(isSoftRetryableGenderError(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.NOT_ELIGIBLE])).toBe(
      false,
    )
  })

  it('keeps the on-camera instruction short so it is not duplicated in the callout', () => {
    expect(getGenderErrorInstruction(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.NOT_ELIGIBLE])).toBe(
      'Verification didn’t meet the required confidence',
    )
    expect(getGenderErrorInstruction(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.NOT_ELIGIBLE])).not.toContain(
      'full access',
    )
  })
})

// End-to-end persona checks: run the real aggregation, then apply the exact
// server bar. Stands in for a live camera test of a female vs. male user.
describe('persona runs (client verdict → server bar)', () => {
  const AGG = {
    minSamples: GENDER_VERIFICATION.minGenderSamples,
    threshold: GENDER_VERIFICATION.minGenderConfidence,
    borderlineBand: GENDER_VERIFICATION.genderBorderlineBand,
  }

  it('female user: a run of mostly-female frames verifies on both client and server', () => {
    const samples = [
      female(0.83),
      female(0.79),
      female(0.88),
      female(0.72),
      male(0.51), // one stray noisy frame, as happens in real light
      female(0.81),
      female(0.86),
    ]
    const verdict = summarizeGenderSamples(samples, AGG)

    expect(verdict.status).toBe('pass')
    expect(verdict.femaleScore).not.toBeNull()

    const verified = serverWouldVerify({
      detectedBlinks: GENDER_VERIFICATION.requiredBlinks,
      livenessScore: 0.82,
      genderDetected: true,
      genderConfidence: verdict.femaleScore ?? 0,
    })
    expect(verified).toBe(true)
  })

  it('male user: a run of mostly-male frames fails the client verdict and never reaches a passing score', () => {
    const samples = [male(0.9), male(0.86), female(0.55), male(0.91), male(0.88), male(0.84)]
    const verdict = summarizeGenderSamples(samples, AGG)

    expect(verdict.status).toBe('fail')

    // Even if the failed score were forwarded, the server bar rejects it.
    const verified = serverWouldVerify({
      detectedBlinks: GENDER_VERIFICATION.requiredBlinks,
      livenessScore: 0.82,
      genderDetected: true,
      genderConfidence: verdict.femaleScore ?? 0,
    })
    expect(verified).toBe(false)
  })

  it('male user cannot pass by blinking more — liveness does not substitute for the gender bar', () => {
    const verified = serverWouldVerify({
      detectedBlinks: GENDER_VERIFICATION.requiredBlinks + 5,
      livenessScore: 1,
      genderDetected: true,
      genderConfidence: 0.4,
    })
    expect(verified).toBe(false)
  })

  it('borderline female read asks for another round instead of failing outright', () => {
    const verdict = summarizeGenderSamples(
      [female(0.55), female(0.58), female(0.56), female(0.57)],
      AGG,
    )
    expect(verdict.status).toBe('insufficient')
  })
})
