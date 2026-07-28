import { describe, expect, it } from 'vitest'

import {
  createBlinkTracker,
  createEarCalibrator,
  eyeAspectRatioFromContour,
  thresholdsFromBaseline,
  updateBlinkTracker,
  updateEarCalibrator,
} from '~/lib/gender-verification/blink'
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
