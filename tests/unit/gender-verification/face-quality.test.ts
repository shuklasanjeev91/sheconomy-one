import { describe, expect, it } from 'vitest'

import { formatVerificationDiagnostics } from '~/lib/gender-verification/constants'
import {
  type FaceQualityMetrics,
  assessFaceQuality,
  blocksGenderSample,
  createFaceQualitySmoother,
  createFaceQualityTally,
  faceQualityHint,
  medianAge,
  recordFaceQuality,
  reportedFaceQualityIssues,
  shouldRetryForQuality,
  smoothFaceQuality,
} from '~/lib/gender-verification/face-quality'
import {
  horizontalEdgeCoverage,
  noseBridgeRect,
  rgbaToLuma,
  toDegrees,
} from '~/lib/gender-verification/face-quality-pixels'
import { getNativeAnalyzerHtml } from '~/lib/gender-verification/native-analyzer-html'

const good: FaceQualityMetrics = {
  faceCount: 1,
  faceLuma: 130,
  frameLuma: 120,
  yawDeg: 3,
  pitchDeg: -4,
  glassesScore: 0.1,
}

describe('assessFaceQuality', () => {
  it('passes a well-lit, frontal, single face', () => {
    expect(assessFaceQuality(good)).toEqual([])
  })

  it('flags each capture problem', () => {
    expect(assessFaceQuality({ ...good, faceCount: 2 })).toEqual(['multiple_faces'])
    expect(assessFaceQuality({ ...good, faceLuma: 30, frameLuma: 35 })).toEqual(['too_dark'])
    expect(assessFaceQuality({ ...good, faceLuma: 80, frameLuma: 170 })).toEqual(['backlit'])
    expect(assessFaceQuality({ ...good, faceLuma: 235, frameLuma: 200 })).toEqual(['too_bright'])
    expect(assessFaceQuality({ ...good, yawDeg: -35 })).toEqual(['turned'])
    expect(assessFaceQuality({ ...good, pitchDeg: 30 })).toEqual(['turned'])
    expect(assessFaceQuality({ ...good, glassesScore: 0.9 })).toEqual(['glasses'])
  })

  it('does not call a bright face backlit just because the room is brighter', () => {
    expect(assessFaceQuality({ ...good, faceLuma: 140, frameLuma: 210 })).toEqual([])
  })

  it('ignores metrics the analyzer could not measure', () => {
    expect(
      assessFaceQuality({
        faceCount: 1,
        faceLuma: null,
        frameLuma: null,
        yawDeg: null,
        pitchDeg: null,
        glassesScore: null,
      }),
    ).toEqual([])
  })

  it('orders issues by priority so the hint names the worst one', () => {
    const issues = assessFaceQuality({ ...good, faceCount: 2, glassesScore: 0.9, faceLuma: 30 })
    expect(issues).toEqual(['multiple_faces', 'too_dark', 'glasses'])
    expect(faceQualityHint(issues)).toMatch(/Only one face/)
  })
})

describe('blocksGenderSample', () => {
  it('drops unusable frames but keeps glasses and glare frames', () => {
    expect(blocksGenderSample(['multiple_faces'])).toBe(true)
    expect(blocksGenderSample(['too_dark'])).toBe(true)
    expect(blocksGenderSample(['turned'])).toBe(true)
    expect(blocksGenderSample(['glasses'])).toBe(false)
    expect(blocksGenderSample(['too_bright', 'backlit'])).toBe(false)
    expect(blocksGenderSample([])).toBe(false)
  })
})

describe('smoothFaceQuality', () => {
  it('ignores a single noisy frame', () => {
    const smoother = createFaceQualitySmoother(3, 2)
    expect(smoothFaceQuality(smoother, ['multiple_faces'])).toEqual([])
    expect(smoothFaceQuality(smoother, [])).toEqual([])
    expect(smoothFaceQuality(smoother, [])).toEqual([])
  })

  it('reports a persistent issue and clears once it goes away', () => {
    const smoother = createFaceQualitySmoother(3, 2)
    smoothFaceQuality(smoother, ['glasses'])
    expect(smoothFaceQuality(smoother, ['glasses'])).toEqual(['glasses'])
    smoothFaceQuality(smoother, [])
    expect(smoothFaceQuality(smoother, [])).toEqual([])
  })
})

describe('quality tally', () => {
  it('reports issues seen in a meaningful share of face frames', () => {
    const tally = createFaceQualityTally()
    for (let i = 0; i < 10; i++) {
      recordFaceQuality(tally, i < 5 ? ['glasses'] : i === 9 ? ['too_dark'] : [])
    }
    expect(reportedFaceQualityIssues(tally, 0.3)).toEqual(['glasses'])
  })

  it('reports nothing before any face frame', () => {
    expect(reportedFaceQualityIssues(createFaceQualityTally())).toEqual([])
  })
})

describe('shouldRetryForQuality', () => {
  it('retries a weak read taken in poor conditions', () => {
    expect(shouldRetryForQuality(0.5, ['glasses'])).toBe(true)
  })

  it('keeps the verdict for clearly male reads or clean conditions', () => {
    expect(shouldRetryForQuality(0.1, ['glasses'])).toBe(false)
    expect(shouldRetryForQuality(0.5, [])).toBe(false)
    expect(shouldRetryForQuality(null, ['too_dark'])).toBe(false)
  })
})

describe('medianAge', () => {
  it('uses only samples that carry an age', () => {
    expect(medianAge([{ age: 30 }, {}, { age: 20 }, { age: 40 }])).toBe(30)
    expect(medianAge([{ age: 20 }, { age: 25 }])).toBe(23)
    expect(medianAge([{}])).toBeNull()
  })
})

describe('pixel measurements', () => {
  it('converts RGBA to luma', () => {
    const luma = rgbaToLuma([255, 255, 255, 255, 0, 0, 0, 255], 2)
    expect(Math.round(luma[0])).toBe(255)
    expect(luma[1]).toBe(0)
  })

  it('scores a dark bar across the bridge high and smooth skin low', () => {
    const size = 24
    const skin = new Float32Array(size * size).fill(150)
    expect(horizontalEdgeCoverage(skin, size)).toBe(0)

    const bridge = new Float32Array(skin)
    for (let col = 0; col < size; col++) {
      for (let row = 10; row < 13; row++) bridge[row * size + col] = 40
    }
    expect(horizontalEdgeCoverage(bridge, size)).toBe(1)

    // A soft vertical shadow down the nose is not a bridge.
    const shadow = new Float32Array(skin)
    for (let row = 0; row < size; row++) {
      for (let col = 10; col < 14; col++) shadow[row * size + col] = 90
    }
    expect(horizontalEdgeCoverage(shadow, size)).toBe(0)
  })

  it('places the bridge patch between the inner eye corners', () => {
    const rect = noseBridgeRect({ x: 100, y: 200 }, { x: 180, y: 200 }, { x: 140, y: 190 })
    expect(rect).toEqual({ x: 120, y: 178, width: 40, height: 48 })
  })

  it('converts radians to whole degrees', () => {
    expect(toDegrees(Math.PI / 6)).toBe(30)
    expect(toDegrees(undefined)).toBeNull()
    expect(toDegrees(Number.NaN)).toBeNull()
  })
})

describe('native analyzer html', () => {
  it('detects several faces and reports quality metrics', () => {
    const html = getNativeAnalyzerHtml()
    expect(html).toContain('maxDetected: 3')
    expect(html).toContain('"innerLeft":133')
    expect(html).toContain('quality: quality')
    // The embedded script must parse.
    const script = html.split('<script>')[1].split('</script>')[0]
    expect(() => new Function(script)).not.toThrow()
  })
})

describe('formatVerificationDiagnostics', () => {
  it('lists age and capture issues after the numbers', () => {
    expect(
      formatVerificationDiagnostics({
        femaleScore: 0.52,
        samples: 5,
        blinks: 2,
        maxFacePixels: 310,
        age: 16,
        issues: ['glasses', 'too_dark'],
      }),
    ).toBe('Read 52% female · 5 samples · 2 blinks · 310px face · age ~16 · glasses · low light')
  })

  it('handles runs with no usable read', () => {
    expect(
      formatVerificationDiagnostics({ femaleScore: null, samples: 0, blinks: 2, maxFacePixels: 0 }),
    ).toBe('No usable read · 0 samples · 2 blinks · 0px face')
  })
})
