import { describe, expect, it } from 'vitest'

import {
  MEETING_FLOATING_MARGIN,
  meetingFloatingCornerForPoint,
  meetingFloatingCornerOrigin,
  meetingFloatingTileSize,
} from '~/co-work/lib/meeting-floating-tile'

describe('meeting floating tile', () => {
  it('sizes a portrait phone tile at 3:4 and a landscape tile at 16:9', () => {
    const phone = meetingFloatingTileSize({ width: 390, height: 700 })
    expect(phone.width).toBe(117)
    expect(phone.height).toBe(156)

    const desktop = meetingFloatingTileSize({ width: 1400, height: 800 })
    expect(desktop.width).toBe(280)
    expect(desktop.height).toBe(158)
  })

  it('gives iPad portrait a larger tile than a phone and never drops below 96px', () => {
    expect(meetingFloatingTileSize({ width: 1000, height: 1300 }).width).toBe(220)
    expect(meetingFloatingTileSize({ width: 250, height: 500 }).width).toBe(96)
  })

  it('never lets the tile take more than 40% of the stage height', () => {
    const landscapePhone = meetingFloatingTileSize({ width: 800, height: 300 })
    expect(landscapePhone.height).toBeLessThanOrEqual(120)
  })

  it('snaps to the quadrant the tile was released in', () => {
    const area = { width: 400, height: 800 }
    expect(meetingFloatingCornerForPoint({ x: 50, y: 50 }, area)).toBe('top-left')
    expect(meetingFloatingCornerForPoint({ x: 350, y: 50 }, area)).toBe('top-right')
    expect(meetingFloatingCornerForPoint({ x: 50, y: 700 }, area)).toBe('bottom-left')
    expect(meetingFloatingCornerForPoint({ x: 350, y: 700 }, area)).toBe('bottom-right')
  })

  it('places each corner inset by the margin', () => {
    const area = { width: 400, height: 800 }
    const tile = { width: 120, height: 160 }
    const m = MEETING_FLOATING_MARGIN
    expect(meetingFloatingCornerOrigin('top-left', area, tile)).toEqual({ x: m, y: m })
    expect(meetingFloatingCornerOrigin('bottom-right', area, tile)).toEqual({
      x: 400 - 120 - m,
      y: 800 - 160 - m,
    })
  })
})
