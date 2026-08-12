import { describe, expect, it } from 'vitest'

import {
  GENDER_ERROR_CODES,
  GENDER_ERROR_MESSAGES,
  classifyGenderError,
} from '~/lib/gender-verification/errors'
import {
  femaleProbability,
  summarizeGenderSamples,
  type GenderSample,
} from '~/lib/gender-verification/gender-aggregate'

const OPTIONS = { minSamples: 4, threshold: 0.6, borderlineBand: 0.08 }

const female = (confidence: number): GenderSample => ({ isFemale: true, confidence })
const male = (confidence: number): GenderSample => ({ isFemale: false, confidence })

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
})
