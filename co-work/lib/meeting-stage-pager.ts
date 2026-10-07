import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

/**
 * Zoom-mobile stage pages, left → right — never more than three:
 * Tap to speak (safe driving) · Active speaker (or the shared screen) · Gallery
 * The gallery is one page; participants beyond the first screenful scroll
 * vertically inside it. Swiping left moves to the next page.
 */
export type MeetingStagePage =
  | { kind: 'safe-driving' }
  | { kind: 'screen-share' }
  | { kind: 'speaker' }
  | { kind: 'gallery' }

export type MeetingStageSwipeDirection = 'next' | 'prev'

export function meetingStagePages(input: {
  /** Camera tiles in the meeting (self included unless hidden). */
  participantTiles: number
  hasScreenShare: boolean
  safeDriving: boolean
}): MeetingStagePage[] {
  const pages: MeetingStagePage[] = []
  if (input.safeDriving) pages.push({ kind: 'safe-driving' })
  pages.push(meetingStageMainPage(input.hasScreenShare))
  // Alone in the room there is nothing to lay out as a gallery.
  if (input.participantTiles >= 2) pages.push({ kind: 'gallery' })
  return pages
}

/** The middle page: the shared screen while someone shares, otherwise the active speaker. */
export function meetingStageMainPage(hasScreenShare: boolean): MeetingStagePage {
  return hasScreenShare ? { kind: 'screen-share' } : { kind: 'speaker' }
}

export function meetingStagePageLabel(page: MeetingStagePage): string {
  switch (page.kind) {
    case 'safe-driving':
      return 'Tap to speak'
    case 'screen-share':
      return 'Shared screen'
    case 'speaker':
      return 'Active speaker'
    case 'gallery':
      return 'Gallery'
  }
}

export function meetingStagePageKey(page: MeetingStagePage): string {
  return page.kind
}

/** The safe-driving page opens its own overlay, so it is never the current stage page. */
export function meetingStagePageIndex(
  pages: MeetingStagePage[],
  current: { viewMode: MeetingViewMode },
): number {
  if (current.viewMode === 'gallery') {
    const index = pages.findIndex((page) => page.kind === 'gallery')
    if (index >= 0) return index
  }
  const main = pages.findIndex((page) => page.kind === 'screen-share' || page.kind === 'speaker')
  return Math.max(0, main)
}

/** Someone new joined: Zoom lands back on the active speaker page. */
export function meetingStageShouldReturnToSpeaker(input: {
  previousTiles: number
  participantTiles: number
  viewMode?: MeetingViewMode
}): boolean {
  if (input.viewMode === 'gallery') return false
  return input.previousTiles > 0 && input.participantTiles > input.previousTiles
}

export function meetingStageSwipeTarget(
  pages: MeetingStagePage[],
  currentIndex: number,
  direction: MeetingStageSwipeDirection,
): MeetingStagePage | null {
  const next = currentIndex + (direction === 'next' ? 1 : -1)
  return pages[next] ?? null
}

export const MEETING_STAGE_SWIPE_SLOP = 10

/**
 * Classify a finished horizontal drag. Finger moving left (negative dx) goes to
 * the next page. Mostly-vertical drags are ignored so tile menus keep working.
 */
export function meetingStageSwipeDirection(input: {
  dx: number
  dy: number
  /** Horizontal velocity in px/ms (optional). */
  vx?: number
  width: number
}): MeetingStageSwipeDirection | null {
  const absX = Math.abs(input.dx)
  const absY = Math.abs(input.dy)
  if (absX < MEETING_STAGE_SWIPE_SLOP * 2 || absX < absY * 1.4) return null
  const distance = Math.max(48, Math.min(120, Math.max(input.width, 1) * 0.15))
  const flick = Math.abs(input.vx ?? 0) >= 0.45 && absX >= MEETING_STAGE_SWIPE_SLOP * 3
  if (absX < distance && !flick) return null
  return input.dx < 0 ? 'next' : 'prev'
}

/** Whether a live drag has become a horizontal page swipe (vs a tap or vertical move). */
export function meetingStageIsHorizontalDrag(dx: number, dy: number): boolean {
  return Math.abs(dx) > MEETING_STAGE_SWIPE_SLOP && Math.abs(dx) > Math.abs(dy) * 1.4
}

/** Rubber-band drag offset: full follow toward a real page, resisted at the ends. */
export function meetingStageDragOffset(
  dx: number,
  canGoNext: boolean,
  canGoPrev: boolean,
): number {
  if ((dx < 0 && canGoNext) || (dx > 0 && canGoPrev)) return dx
  return dx * 0.25
}
