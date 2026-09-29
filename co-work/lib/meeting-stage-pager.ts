import type { MeetingViewMode } from '~/co-work/lib/meeting-state-machine'

/**
 * Zoom-mobile stage pages, left → right:
 * [Safe driving] · [Shared screen] · Active speaker · Gallery 1 · Gallery 2 · …
 * Swiping left moves to the next page, swiping right to the previous one.
 */
export type MeetingStagePage =
  | { kind: 'safe-driving' }
  | { kind: 'screen-share' }
  | { kind: 'speaker' }
  | { kind: 'gallery'; page: number }

export type MeetingStageSwipeDirection = 'next' | 'prev'

export function meetingStagePages(input: {
  /** Camera tiles in the meeting (self included unless hidden). */
  participantTiles: number
  pageSize: number
  hasScreenShare: boolean
  safeDriving: boolean
}): MeetingStagePage[] {
  const pages: MeetingStagePage[] = []
  if (input.safeDriving) pages.push({ kind: 'safe-driving' })
  if (input.hasScreenShare) pages.push({ kind: 'screen-share' })
  pages.push({ kind: 'speaker' })
  // Alone in the room there is nothing to lay out as a gallery.
  if (input.participantTiles >= 2) {
    const size = Math.max(1, Math.floor(input.pageSize))
    const count = Math.ceil(input.participantTiles / size)
    for (let page = 0; page < count; page += 1) pages.push({ kind: 'gallery', page })
  }
  return pages
}

export function meetingStagePageLabel(page: MeetingStagePage): string {
  switch (page.kind) {
    case 'safe-driving':
      return 'Safe driving mode'
    case 'screen-share':
      return 'Shared screen'
    case 'speaker':
      return 'Active speaker'
    case 'gallery':
      return `Gallery page ${page.page + 1}`
  }
}

export function meetingStagePageKey(page: MeetingStagePage): string {
  return page.kind === 'gallery' ? `gallery-${page.page}` : page.kind
}

export function meetingStagePageIndex(
  pages: MeetingStagePage[],
  current: { viewMode: MeetingViewMode; galleryPage: number; hasScreenShare: boolean },
): number {
  const find = (predicate: (page: MeetingStagePage) => boolean) => pages.findIndex(predicate)
  if (current.viewMode === 'screen-share' && current.hasScreenShare) {
    const index = find((page) => page.kind === 'screen-share')
    if (index >= 0) return index
  }
  if (current.viewMode === 'gallery') {
    const galleryPages = pages.filter((page) => page.kind === 'gallery')
    if (galleryPages.length > 0) {
      const target = Math.min(Math.max(0, current.galleryPage), galleryPages.length - 1)
      const index = find((page) => page.kind === 'gallery' && page.page === target)
      if (index >= 0) return index
    }
  }
  return Math.max(0, find((page) => page.kind === 'speaker'))
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
