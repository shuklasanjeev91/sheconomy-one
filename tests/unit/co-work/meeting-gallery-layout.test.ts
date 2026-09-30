import { describe, expect, it } from 'vitest'

import {
  capFilmstripTracks,
  meetingGalleryLayout,
  meetingGalleryPageForIndex,
  meetingGalleryPages,
  meetingFilmstripWindow,
  meetingGalleryScrollLayout,
  meetingGalleryScrollWindow,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import { participantDisplayName } from '~/co-work/lib/participant-avatar'

describe('Zoom-style meeting gallery', () => {
  it('uses a balanced 2x2 gallery for three cameras on portrait devices', () => {
    expect(meetingGalleryLayout(3, { width: 366, height: 560 })).toEqual({
      columns: 2,
      rows: 2,
    })
    expect(meetingGalleryLayout(3, { width: 984, height: 520 })).toEqual({
      columns: 3,
      rows: 1,
    })
  })

  it('packs phone landscape across width instead of rotating portrait stacks', () => {
    expect(meetingGalleryLayout(3, { width: 640, height: 280, preferWide: true })).toEqual({
      columns: 3,
      rows: 1,
    })
    expect(meetingGalleryLayout(2, { width: 640, height: 280 })).toEqual({
      columns: 2,
      rows: 1,
    })
    expect(meetingGalleryLayout(4, { width: 700, height: 300, preferWide: true })).toEqual({
      columns: 4,
      rows: 1,
    })
  })

  it('uses Zoom-style grids for 2 / 4 / 6 / 9 participants', () => {
    expect(meetingGalleryLayout(2, { width: 900, height: 600 })).toEqual({ columns: 2, rows: 1 })
    expect(meetingGalleryLayout(4, { width: 700, height: 700 })).toEqual({ columns: 2, rows: 2 })
    expect(meetingGalleryLayout(6, { width: 800, height: 700 })).toEqual({ columns: 3, rows: 2 })
    expect(meetingGalleryLayout(9, { width: 900, height: 700 })).toEqual({ columns: 3, rows: 3 })
  })

  it('keeps four participants in a 2x2 tablet gallery', () => {
    expect(meetingGalleryLayout(4, { width: 980, height: 620 })).toEqual({
      columns: 2,
      rows: 2,
    })
  })

  it('does not expose internal user ids in participant labels', () => {
    expect(
      participantDisplayName({ name: 'user_00bc8abb', identity: 'user_00bc8abb' } as { name: string; identity: string }),
    ).toBe('Guest')
    expect(participantDisplayName({ name: 'Ritu Singh', identity: 'user_123' } as { name: string; identity: string })).toBe(
      'Ritu Singh',
    )
  })

  it('packs dense 25 and 49 tile pages for large rooms', () => {
    expect(meetingGalleryLayout(25, { width: 1280, height: 800 })).toEqual({
      columns: 5,
      rows: 5,
    })
    expect(meetingGalleryLayout(49, { width: 1400, height: 900 })).toEqual({
      columns: 7,
      rows: 7,
    })
  })

  it('caps filmstrip for speaker/share decoder budget', () => {
    expect(capFilmstripTracks(Array.from({ length: 40 }, (_, i) => i)).overflow).toBe(28)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 9,
        denseGallery: true,
        breakpoint: 'large-desktop',
      }),
    ).toBe(25)
  })

  it('scales gallery pages by breakpoint and dense mode', () => {
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 9,
        denseGallery: true,
        breakpoint: 'mobile',
      }),
    ).toBe(12)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 16,
        denseGallery: true,
        breakpoint: 'tablet',
      }),
    ).toBe(16)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 4,
        denseGallery: false,
        breakpoint: 'mobile',
      }),
    ).toBe(4)
    expect(
      resolveMeetingGalleryPageSize({
        basePageSize: 25,
        denseGallery: false,
        breakpoint: 'large-desktop',
      }),
    ).toBe(25)
  })

  it('maps indexes to gallery pages for swipe paging', () => {
    expect(meetingGalleryPageForIndex(0, 6)).toBe(0)
    expect(meetingGalleryPageForIndex(6, 6)).toBe(1)
    expect(meetingGalleryPages([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 6)).toEqual([
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ])
  })

})

describe('meetingFilmstripWindow', () => {
  it('mounts an initial batch before the strip is measured', () => {
    expect(
      meetingFilmstripWindow({ total: 30, itemSize: 140, scrollOffset: 0, viewportSize: 0 }),
    ).toEqual({ start: 0, end: 8 })
    expect(
      meetingFilmstripWindow({ total: 3, itemSize: 140, scrollOffset: 0, viewportSize: 0 }),
    ).toEqual({ start: 0, end: 3 })
  })

  it('mounts only the visible tiles plus overscan at the top of the strip', () => {
    // 400px viewport / 140px tiles → tiles 0..2 visible, +2 overscan.
    expect(
      meetingFilmstripWindow({ total: 30, itemSize: 140, scrollOffset: 0, viewportSize: 400 }),
    ).toEqual({ start: 0, end: 5 })
  })

  it('loads later participants as the strip scrolls', () => {
    const window = meetingFilmstripWindow({
      total: 30,
      itemSize: 140,
      scrollOffset: 1400,
      viewportSize: 400,
      leadingOffset: 44,
    })
    expect(window.start).toBeLessThanOrEqual(9)
    expect(window.end).toBeGreaterThanOrEqual(13)
    expect(window.end - window.start).toBeLessThan(10)
  })

  it('clamps to the end of the list', () => {
    expect(
      meetingFilmstripWindow({ total: 30, itemSize: 140, scrollOffset: 99_999, viewportSize: 400 }),
    ).toEqual({ start: 30, end: 30 })
    expect(
      meetingFilmstripWindow({ total: 30, itemSize: 140, scrollOffset: 3800, viewportSize: 400 }),
    ).toEqual({ start: 25, end: 30 })
    expect(
      meetingFilmstripWindow({ total: 0, itemSize: 140, scrollOffset: 0, viewportSize: 400 }),
    ).toEqual({ start: 0, end: 0 })
  })
})

describe('meetingGalleryScrollLayout', () => {
  it('fits small meetings on one screen without scrolling', () => {
    const layout = meetingGalleryScrollLayout(4, {
      width: 390,
      height: 640,
      screenSize: 12,
      gap: 10,
    })
    expect(layout).toMatchObject({ columns: 2, rows: 2, visibleRows: 2, scrolls: false })
    expect(layout.rowHeight).toBe(315)
  })

  it('shows one device-sized screen and scrolls for the rest of a large meeting', () => {
    const layout = meetingGalleryScrollLayout(30, {
      width: 390,
      height: 700,
      screenSize: 12,
      gap: 10,
    })
    expect(layout.scrolls).toBe(true)
    expect(layout.columns).toBe(3)
    expect(layout.visibleRows).toBe(4)
    expect(layout.rows).toBe(10)
    // Four rows plus a peek of the fifth fit inside the stage height.
    expect(layout.rowHeight * 4 + 10 * 4).toBeLessThan(700)
    expect(layout.rowHeight * 5 + 10 * 4).toBeGreaterThan(700)
  })

  it('keeps rows readable on short stages', () => {
    const layout = meetingGalleryScrollLayout(40, {
      width: 800,
      height: 200,
      screenSize: 16,
      gap: 10,
      minRowHeight: 96,
    })
    expect(layout.scrolls).toBe(true)
    expect(layout.rowHeight).toBe(96)
  })
})

describe('meetingGalleryScrollWindow', () => {
  it('mounts the first screen plus one row before the gallery is measured', () => {
    expect(
      meetingGalleryScrollWindow({
        total: 30,
        columns: 3,
        rowStride: 160,
        scrollOffset: 0,
        viewportSize: 0,
        rowsPerViewport: 5,
      }),
    ).toEqual({ start: 0, end: 18, visibleStart: 0, visibleEnd: 15 })
  })

  it('moves the mounted rows with the scroll position', () => {
    // Rows 3..7 on screen (480..1180px), one overscan row either side.
    expect(
      meetingGalleryScrollWindow({
        total: 30,
        columns: 3,
        rowStride: 160,
        scrollOffset: 480,
        viewportSize: 700,
        rowsPerViewport: 5,
      }),
    ).toEqual({ start: 6, end: 27, visibleStart: 9, visibleEnd: 24 })
  })

  it('clamps to the last row', () => {
    expect(
      meetingGalleryScrollWindow({
        total: 31,
        columns: 3,
        rowStride: 160,
        scrollOffset: 99_999,
        viewportSize: 700,
        rowsPerViewport: 5,
      }),
    ).toEqual({ start: 27, end: 31, visibleStart: 30, visibleEnd: 31 })
  })
})
