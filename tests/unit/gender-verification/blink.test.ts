import { describe, expect, it } from 'vitest'

import {
  createBlinkTracker,
  createEarCalibrator,
  eyeAspectRatioFromContour,
  stepBlinkLiveness,
  thresholdsFromBaseline,
  updateBlinkTracker,
  updateEarCalibrator,
} from '~/lib/gender-verification/blink'
import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'
import { updateGestureBlinkTracker, createGestureBlinkTracker } from '~/lib/gender-verification/human-liveness.web'

describe('gender verification blink tracking', () => {
  it('counts a natural close→open blink via EAR', () => {
    const tracker = createBlinkTracker()
    const opts = {
      blinkThreshold: 0.2,
      openThreshold: 0.26,
      minClosedMs: 50,
      maxClosedMs: 900,
      minBlinkGapMs: 200,
      now: 1000,
    }

    updateBlinkTracker(tracker, 0.3, 0.3, opts)
    expect(tracker.count).toBe(0)

    updateBlinkTracker(tracker, 0.12, 0.12, { ...opts, now: 1050 })
    expect(tracker.eyesClosed).toBe(true)

    updateBlinkTracker(tracker, 0.3, 0.3, { ...opts, now: 1200 })
    expect(tracker.count).toBe(1)
  })

  it('requires two separate natural blinks and rejects eyes held closed', () => {
    const tracker = createBlinkTracker()
    const opts = {
      blinkThreshold: 0.2,
      openThreshold: 0.26,
      minClosedMs: 50,
      maxClosedMs: 900,
      minBlinkGapMs: 280,
      now: 1000,
    }

    updateBlinkTracker(tracker, 0.12, 0.12, opts)
    updateBlinkTracker(tracker, 0.3, 0.3, { ...opts, now: 1150 })
    expect(tracker.count).toBe(1)

    updateBlinkTracker(tracker, 0.1, 0.1, { ...opts, now: 1500 })
    updateBlinkTracker(tracker, 0.3, 0.3, { ...opts, now: 1650 })
    expect(tracker.count).toBe(2)

    updateBlinkTracker(tracker, 0.1, 0.1, { ...opts, now: 2000 })
    updateBlinkTracker(tracker, 0.3, 0.3, { ...opts, now: 3001 })
    expect(tracker.count).toBe(2)
  })

  it('does not count a one-frame gesture flash under minClosedMs', () => {
    const tracker = createGestureBlinkTracker()
    updateGestureBlinkTracker(tracker, true, 1000)
    updateGestureBlinkTracker(tracker, false, 1030)
    expect(tracker.count).toBe(0)
  })

  it('counts sustained eyesClosed for gesture tracker', () => {
    const tracker = createGestureBlinkTracker()
    updateGestureBlinkTracker(tracker, true, 1000)
    updateGestureBlinkTracker(tracker, false, 1200)
    expect(tracker.count).toBe(1)
  })

  it('computes EAR from a 6-point contour', () => {
    const open = eyeAspectRatioFromContour([
      { x: 0, y: 0 },
      { x: 1, y: -2 },
      { x: 2, y: -2 },
      { x: 3, y: 0 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ])
    const closed = eyeAspectRatioFromContour([
      { x: 0, y: 0 },
      { x: 1, y: -0.2 },
      { x: 2, y: -0.2 },
      { x: 3, y: 0 },
      { x: 2, y: 0.2 },
      { x: 1, y: 0.2 },
    ])
    expect(open).toBeGreaterThan(closed)
    expect(closed).toBeLessThan(0.2)
  })

  it('builds adaptive thresholds from open-eye baseline', () => {
    const calibrator = createEarCalibrator()
    for (let i = 0; i < 10; i++) updateEarCalibrator(calibrator, 0.3, 10)
    expect(calibrator.baseline).toBeCloseTo(0.3, 2)
    const t = thresholdsFromBaseline(calibrator.baseline, 0.2, 0.26)
    expect(t.calibrated).toBe(true)
    expect(t.blinkThreshold).toBeLessThan(0.3)
  })
})

/**
 * Replays a camera at a fixed frame interval against a face that blinks on a
 * schedule. EAR values were measured with the real Human mesh on a test face:
 * open 0.315, closed 0.153.
 */
function simulate({
  frameMs,
  closedMs,
  periodMs,
  durationMs,
  openEar,
  closedEar,
  calibrationSamples,
  maxClosedMs = GENDER_VERIFICATION.maxClosedMs,
}: {
  frameMs: number
  closedMs: number
  periodMs: number
  durationMs: number
  openEar: number
  closedEar: number
  calibrationSamples: number
  maxClosedMs?: number
}) {
  const tracker = createBlinkTracker()
  const calibrator = createEarCalibrator()
  let firstPassAt: number | null = null
  for (let now = 0; now <= durationMs; now += frameMs) {
    const phase = now % periodMs
    const closed = phase >= periodMs - closedMs
    const ear = closed ? closedEar : openEar
    const step = stepBlinkLiveness(tracker, calibrator, ear, ear, {
      calibrationSamples,
      fallbackBlink: GENDER_VERIFICATION.earBlinkThreshold,
      fallbackOpen: GENDER_VERIFICATION.earOpenThreshold,
      minClosedMs: GENDER_VERIFICATION.minClosedMs,
      maxClosedMs,
      minBlinkGapMs: GENDER_VERIFICATION.minBlinkGapMs,
      now,
    })
    if (firstPassAt == null && step.count >= GENDER_VERIFICATION.requiredBlinks) firstPassAt = now
  }
  return { count: tracker.count, firstPassAt }
}

describe('blink liveness across platforms', () => {
  it('web (~15 fps) counts natural 150 ms blinks', () => {
    const r = simulate({
      frameMs: 66,
      closedMs: 150,
      periodMs: 1500,
      durationMs: 6000,
      openEar: 0.315,
      closedEar: 0.153,
      calibrationSamples: GENDER_VERIFICATION.earCalibrationSamples,
    })
    expect(r.firstPassAt).not.toBeNull()
    expect(r.firstPassAt!).toBeLessThan(4000)
  })

  it.each([700, 1000, 1500])(
    'native (a photo every %i ms) counts the "close your eyes for 2 seconds" blink',
    (frameMs) => {
      const r = simulate({
        frameMs,
        closedMs: 2000,
        periodMs: 4500,
        durationMs: 20000,
        openEar: 0.315,
        closedEar: 0.153,
        calibrationSamples: GENDER_VERIFICATION.nativeEarCalibrationSamples,
        maxClosedMs: GENDER_VERIFICATION.nativeMaxClosedMs,
      })
      expect(r.firstPassAt).not.toBeNull()
      expect(r.firstPassAt!).toBeLessThan(15000)
    },
  )

  it('works for faces whose open-eye EAR is low (was stuck on "Open your eyes")', () => {
    const r = simulate({
      frameMs: 66,
      closedMs: 200,
      periodMs: 1500,
      durationMs: 6000,
      openEar: 0.16,
      closedEar: 0.08,
      calibrationSamples: GENDER_VERIFICATION.earCalibrationSamples,
    })
    expect(r.firstPassAt).not.toBeNull()
  })

  it('does not count blinks from a still photo', () => {
    const r = simulate({
      frameMs: 66,
      closedMs: 0,
      periodMs: 1500,
      durationMs: 8000,
      openEar: 0.315,
      closedEar: 0.315,
      calibrationSamples: GENDER_VERIFICATION.earCalibrationSamples,
    })
    expect(r.count).toBe(0)
  })

  it('does not count eyes held shut longer than maxClosedMs', () => {
    const tracker = createBlinkTracker()
    const calibrator = createEarCalibrator()
    const opts = {
      calibrationSamples: 3,
      fallbackBlink: 0.2,
      fallbackOpen: 0.26,
      minClosedMs: GENDER_VERIFICATION.minClosedMs,
      maxClosedMs: GENDER_VERIFICATION.maxClosedMs,
      minBlinkGapMs: GENDER_VERIFICATION.minBlinkGapMs,
    }
    for (let now = 0; now < 300; now += 100) stepBlinkLiveness(tracker, calibrator, 0.3, 0.3, { ...opts, now })
    for (let now = 300; now < 300 + GENDER_VERIFICATION.maxClosedMs + 400; now += 100) {
      stepBlinkLiveness(tracker, calibrator, 0.14, 0.14, { ...opts, now })
    }
    stepBlinkLiveness(tracker, calibrator, 0.3, 0.3, { ...opts, now: 5000 })
    expect(tracker.count).toBe(0)
  })
})
