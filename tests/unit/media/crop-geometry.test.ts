import { describe, expect, it } from 'vitest'

import { aspectFitCropRect, centeredCropRect } from '~/lib/media/crop-geometry'

describe('aspectFitCropRect', () => {
  it('keeps a crop the user panned to the side of the photo', () => {
    const sourceWidth = 3000
    const sourceHeight = 2000
    const panned = { originX: 1000, originY: 100, width: 1800, height: 1500 }

    const fitted = aspectFitCropRect(panned, sourceWidth, sourceHeight, [1, 1])

    expect(fitted).toEqual({ originX: 1150, originY: 100, width: 1500, height: 1500 })
    expect(centeredCropRect(sourceWidth, sourceHeight, [1, 1]).originX).toBe(500)
  })

  it('does not jump a wide cover crop back to the middle', () => {
    const rect = { originX: 1800, originY: 400, width: 900, height: 280 }
    const fitted = aspectFitCropRect(rect, 4000, 3000, [3, 1])

    expect(fitted.originX).toBeGreaterThan(1500)
    expect(fitted.width / fitted.height).toBeCloseTo(3, 1)
  })
})
