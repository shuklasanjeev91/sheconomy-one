import { describe, expect, it } from 'vitest'

import {
  meetingStageDragOffset,
  meetingStageIsHorizontalDrag,
  meetingStagePageIndex,
  meetingStagePageKey,
  meetingStagePageLabel,
  meetingStagePages,
  meetingStageShouldReturnToSpeaker,
  meetingStageSwipeDirection,
  meetingStageSwipeTarget,
} from '~/co-work/lib/meeting-stage-pager'

describe('Zoom-style stage pager', () => {
  it('has exactly three pages: tap to speak → active speaker → gallery', () => {
    expect(
      meetingStagePages({ participantTiles: 100, hasScreenShare: false, safeDriving: true }),
    ).toEqual([{ kind: 'safe-driving' }, { kind: 'speaker' }, { kind: 'gallery' }])
  })

  it('shows the shared screen on the middle page while someone shares', () => {
    expect(
      meetingStagePages({ participantTiles: 100, hasScreenShare: true, safeDriving: true }),
    ).toEqual([{ kind: 'safe-driving' }, { kind: 'screen-share' }, { kind: 'gallery' }])
  })

  it('has no gallery page when alone', () => {
    expect(
      meetingStagePages({ participantTiles: 1, hasScreenShare: false, safeDriving: true }),
    ).toEqual([{ kind: 'safe-driving' }, { kind: 'speaker' }])
  })

  it('labels and keys pages by kind', () => {
    expect(meetingStagePageLabel({ kind: 'safe-driving' })).toBe('Tap to speak')
    expect(meetingStagePageLabel({ kind: 'gallery' })).toBe('Gallery')
    expect(meetingStagePageLabel({ kind: 'screen-share' })).toBe('Shared screen')
    expect(meetingStagePageKey({ kind: 'speaker' })).toBe('speaker')
  })

  it('maps the view mode to a page index, never to the tap-to-speak page', () => {
    const pages = meetingStagePages({ participantTiles: 9, hasScreenShare: false, safeDriving: true })
    expect(meetingStagePageIndex(pages, { viewMode: 'speaker' })).toBe(1)
    expect(meetingStagePageIndex(pages, { viewMode: 'gallery' })).toBe(2)
    // Share ended but the view mode has not caught up yet → speaker.
    expect(meetingStagePageIndex(pages, { viewMode: 'screen-share' })).toBe(1)
    const sharing = meetingStagePages({ participantTiles: 9, hasScreenShare: true, safeDriving: true })
    expect(meetingStagePageIndex(sharing, { viewMode: 'screen-share' })).toBe(1)
  })

  it('swipes to neighbours and stops at the ends', () => {
    const pages = meetingStagePages({ participantTiles: 5, hasScreenShare: false, safeDriving: true })
    expect(meetingStageSwipeTarget(pages, 1, 'next')).toEqual({ kind: 'gallery' })
    expect(meetingStageSwipeTarget(pages, 1, 'prev')).toEqual({ kind: 'safe-driving' })
    expect(meetingStageSwipeTarget(pages, 0, 'prev')).toBeNull()
    expect(meetingStageSwipeTarget(pages, pages.length - 1, 'next')).toBeNull()
  })

  it('returns to the active speaker page when someone joins', () => {
    expect(meetingStageShouldReturnToSpeaker({ previousTiles: 1, participantTiles: 2 })).toBe(true)
    expect(meetingStageShouldReturnToSpeaker({ previousTiles: 8, participantTiles: 9 })).toBe(true)
    // Someone left, or the first roster load after joining.
    expect(meetingStageShouldReturnToSpeaker({ previousTiles: 9, participantTiles: 8 })).toBe(false)
    expect(meetingStageShouldReturnToSpeaker({ previousTiles: 0, participantTiles: 5 })).toBe(false)
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
