import { describe, expect, it } from 'vitest'

import {
  meetingStageDragOffset,
  meetingStageIsHorizontalDrag,
  meetingStagePageIndex,
  meetingStagePageKey,
  meetingStagePageLabel,
  meetingStagePages,
  meetingStageSwipeDirection,
  meetingStageSwipeTarget,
} from '~/co-work/lib/meeting-stage-pager'

describe('Zoom-style stage pager', () => {
  it('orders pages driving → share → speaker → gallery pages', () => {
    expect(
      meetingStagePages({ participantTiles: 9, pageSize: 4, hasScreenShare: true, safeDriving: true }),
    ).toEqual([
      { kind: 'safe-driving' },
      { kind: 'screen-share' },
      { kind: 'speaker' },
      { kind: 'gallery', page: 0 },
      { kind: 'gallery', page: 1 },
      { kind: 'gallery', page: 2 },
    ])
  })

  it('has no gallery page when alone', () => {
    expect(
      meetingStagePages({ participantTiles: 1, pageSize: 4, hasScreenShare: false, safeDriving: false }),
    ).toEqual([{ kind: 'speaker' }])
  })

  it('labels gallery pages from 1', () => {
    expect(meetingStagePageLabel({ kind: 'gallery', page: 1 })).toBe('Gallery page 2')
    expect(meetingStagePageKey({ kind: 'gallery', page: 1 })).toBe('gallery-1')
    expect(meetingStagePageKey({ kind: 'speaker' })).toBe('speaker')
  })

  it('gives 1:1 meetings a speaker page and one gallery page', () => {
    expect(
      meetingStagePages({ participantTiles: 2, pageSize: 4, hasScreenShare: false, safeDriving: false }),
    ).toEqual([{ kind: 'speaker' }, { kind: 'gallery', page: 0 }])
  })

  it('maps the view mode + gallery page to a page index', () => {
    const pages = meetingStagePages({
      participantTiles: 9,
      pageSize: 4,
      hasScreenShare: false,
      safeDriving: true,
    })
    expect(meetingStagePageIndex(pages, { viewMode: 'speaker', galleryPage: 0, hasScreenShare: false })).toBe(1)
    expect(meetingStagePageIndex(pages, { viewMode: 'gallery', galleryPage: 1, hasScreenShare: false })).toBe(3)
    // Stale page after people leave clamps to the last gallery page.
    expect(meetingStagePageIndex(pages, { viewMode: 'gallery', galleryPage: 9, hasScreenShare: false })).toBe(4)
    // Share ended but the view mode has not caught up yet → speaker.
    expect(
      meetingStagePageIndex(pages, { viewMode: 'screen-share', galleryPage: 0, hasScreenShare: false }),
    ).toBe(1)
  })

  it('swipes to neighbours and stops at the ends', () => {
    const pages = meetingStagePages({
      participantTiles: 5,
      pageSize: 4,
      hasScreenShare: false,
      safeDriving: true,
    })
    expect(meetingStageSwipeTarget(pages, 1, 'next')).toEqual({ kind: 'gallery', page: 0 })
    expect(meetingStageSwipeTarget(pages, 1, 'prev')).toEqual({ kind: 'safe-driving' })
    expect(meetingStageSwipeTarget(pages, 0, 'prev')).toBeNull()
    expect(meetingStageSwipeTarget(pages, pages.length - 1, 'next')).toBeNull()
  })

  it('treats a leftward drag as next and ignores short or vertical drags', () => {
    expect(meetingStageSwipeDirection({ dx: -90, dy: 10, width: 390 })).toBe('next')
    expect(meetingStageSwipeDirection({ dx: 90, dy: -12, width: 390 })).toBe('prev')
    expect(meetingStageSwipeDirection({ dx: -30, dy: 0, width: 390 })).toBeNull()
    expect(meetingStageSwipeDirection({ dx: -35, dy: 0, vx: -0.8, width: 390 })).toBe('next')
    expect(meetingStageSwipeDirection({ dx: -90, dy: 120, width: 390 })).toBeNull()
  })

  it('detects horizontal drags and rubber-bands past the ends', () => {
    expect(meetingStageIsHorizontalDrag(24, 4)).toBe(true)
    expect(meetingStageIsHorizontalDrag(6, 0)).toBe(false)
    expect(meetingStageIsHorizontalDrag(20, 30)).toBe(false)
    expect(meetingStageDragOffset(-80, true, false)).toBe(-80)
    expect(meetingStageDragOffset(80, true, false)).toBe(20)
  })
})
