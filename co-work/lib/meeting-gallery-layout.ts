export type GalleryLayout = {
  columns: number
  rows: number
}

export type GalleryLayoutOptions = {
  /** Usable stage width in px (after UI insets / padding). */
  width: number
  /** Usable stage height in px (after UI insets / padding). */
  height: number
  /** Prefer wide/landscape packing when the orientation policy says so. */
  preferWide?: boolean
}

/**
 * Responsive gallery grid — Zoom / Meet style equal tiles.
 *
 * Examples (portrait-friendly defaults):
 * - 2 → two large tiles (side-by-side when wide enough, else stacked)
 * - 4 → 2×2
 * - 6 → 3×2 or 2×3
 * - 9 → 3×3 when width allows
 * - more → denser grid; UI paginates beyond pageSize
 */
export function meetingGalleryLayout(
  trackCount: number,
  options: GalleryLayoutOptions,
): GalleryLayout {
  const count = Math.max(trackCount, 1)
  if (count <= 1) return { columns: 1, rows: 1 }

  const width = Math.max(options.width, 1)
  const height = Math.max(options.height, 1)
  const aspect = width / height
  const narrowPortrait = aspect < 0.78 // phone portrait stages
  const phoneLandscape =
    aspect >= 1.25 &&
    width >= 500 &&
    width < 900 &&
    (options.preferWide || height < 480 || aspect >= 1.6)
  const wideLandscape = aspect >= 1.45 && width >= 900

  if (count === 2) {
    // Two large equal tiles — side-by-side except on very narrow portrait phones.
    return narrowPortrait && !phoneLandscape ? { columns: 1, rows: 2 } : { columns: 2, rows: 1 }
  }

  if (count === 3) {
    if (wideLandscape || phoneLandscape) return { columns: 3, rows: 1 }
    return { columns: 2, rows: 2 }
  }

  if (count === 4) {
    if (phoneLandscape && width >= 640) return { columns: 4, rows: 1 }
    return { columns: 2, rows: 2 }
  }

  if (count <= 6) {
    if (phoneLandscape || (width >= 700 && aspect >= 0.95)) return { columns: 3, rows: 2 }
    return { columns: 2, rows: 3 }
  }

  if (count <= 9) {
    // Prefer a true 3×3 gallery whenever the stage can hold it.
    if (width >= 560 || phoneLandscape || options.preferWide) return { columns: 3, rows: 3 }
    return { columns: 2, rows: Math.ceil(count / 2) }
  }

  if (count <= 16) {
    if (width >= 900) return { columns: 4, rows: 4 }
    if (width >= 720 || phoneLandscape) return { columns: 4, rows: Math.ceil(count / 4) }
    return { columns: 3, rows: Math.ceil(count / 3) }
  }

  if (count <= 25) {
    // Zoom-style 5×5 dense page on wide desktops.
    if (width >= 1020) return { columns: 5, rows: 5 }
    if (width >= 900) return { columns: 5, rows: Math.ceil(count / 5) }
    return { columns: 4, rows: Math.ceil(count / 4) }
  }

  if (count <= 49) {
    // Optional ultra-dense 7×7 (large-desktop + dense gallery toggle).
    if (width >= 1280) return { columns: 7, rows: Math.ceil(count / 7) }
    if (width >= 1020) return { columns: 5, rows: Math.ceil(count / 5) }
    return { columns: 4, rows: Math.ceil(count / 4) }
  }

  const columns = width >= 1280 ? 7 : width >= 1100 ? 5 : width >= 720 || phoneLandscape ? 4 : 3
  return { columns, rows: Math.ceil(count / columns) }
}

/** Visible filmstrip tiles in speaker/share — keep decoder budget bounded at ~100 peers. */
export const MEETING_FILMSTRIP_VISIBLE_CAP = 12

export function capFilmstripTracks<T>(tracks: T[], cap = MEETING_FILMSTRIP_VISIBLE_CAP): {
  visible: T[]
  overflow: number
} {
  const limit = Math.max(1, Math.floor(cap))
  if (tracks.length <= limit) return { visible: tracks, overflow: 0 }
  return { visible: tracks.slice(0, limit), overflow: tracks.length - limit }
}

/**
 * Index window of filmstrip tiles to mount for the current scroll position, so
 * large rooms load more tiles as the strip scrolls instead of mounting all.
 * `end` is exclusive.
 */
export function meetingFilmstripWindow(input: {
  total: number
  /** Tile length along the scroll axis, including the gap after it. */
  itemSize: number
  scrollOffset: number
  /** Visible length of the strip; 0 before first measure. */
  viewportSize: number
  /** Space before the first tile (header, padding). */
  leadingOffset?: number
  overscan?: number
  /** Tiles to mount before the strip has been measured. */
  initialCount?: number
}): { start: number; end: number } {
  const total = Math.max(0, Math.floor(input.total))
  if (total === 0) return { start: 0, end: 0 }
  const itemSize = Math.max(1, input.itemSize)
  const overscan = Math.max(0, Math.floor(input.overscan ?? 2))
  if (input.viewportSize <= 0) {
    return { start: 0, end: Math.min(total, Math.max(1, input.initialCount ?? 8)) }
  }
  const offset = Math.max(0, input.scrollOffset - (input.leadingOffset ?? 0))
  const first = Math.floor(offset / itemSize)
  const last = Math.ceil((offset + input.viewportSize) / itemSize)
  return {
    start: Math.min(Math.max(0, first - overscan), total),
    end: Math.min(total, Math.max(last + overscan, 1)),
  }
}

/** Fraction of the next row left visible so a scrollable gallery reads as scrollable. */
export const MEETING_GALLERY_SCROLL_PEEK = 0.3

export type MeetingGalleryScrollLayout = {
  columns: number
  /** Total rows across every participant. */
  rows: number
  rowHeight: number
  /** Rows that fit in one screen of the stage. */
  visibleRows: number
  /** More participants than fit on screen — render a vertically scrolling grid. */
  scrolls: boolean
}

/**
 * Gallery that fits one device-sized screen of tiles (`screenSize`, from the
 * responsive page size) and scrolls vertically for everyone else.
 */
export function meetingGalleryScrollLayout(
  total: number,
  options: GalleryLayoutOptions & {
    screenSize: number
    gap?: number
    minRowHeight?: number
  },
): MeetingGalleryScrollLayout {
  const count = Math.max(0, Math.floor(total))
  const perScreen = Math.max(1, Math.floor(options.screenSize))
  const gap = Math.max(0, options.gap ?? 10)
  const height = Math.max(options.height, 1)
  const minRowHeight = Math.max(1, options.minRowHeight ?? 96)
  const layoutOptions = {
    width: options.width,
    height: options.height,
    preferWide: options.preferWide,
  }
  if (count <= perScreen) {
    const fit = meetingGalleryLayout(count, layoutOptions)
    return {
      columns: fit.columns,
      rows: fit.rows,
      rowHeight: Math.max(minRowHeight, Math.floor((height - gap * (fit.rows - 1)) / fit.rows)),
      visibleRows: fit.rows,
      scrolls: false,
    }
  }
  const screen = meetingGalleryLayout(perScreen, layoutOptions)
  const visibleRows = screen.rows
  return {
    columns: screen.columns,
    rows: Math.ceil(count / screen.columns),
    rowHeight: Math.max(
      minRowHeight,
      Math.floor((height - gap * visibleRows) / (visibleRows + MEETING_GALLERY_SCROLL_PEEK)),
    ),
    visibleRows,
    scrolls: true,
  }
}

/**
 * Zoom-style max tiles per gallery page. Larger rooms still paginate;
 * desktop dense mode can show a full 5×5 page.
 */
export const MEETING_GALLERY_MAX_VISIBLE = 25

/** Dense gallery page sizes by breakpoint (Zoom-style). */
export const MEETING_DENSE_GALLERY_PAGE_SIZE = 25
export const MEETING_DENSE_GALLERY_PAGE_SIZE_TABLET = 16
export const MEETING_DENSE_GALLERY_PAGE_SIZE_MOBILE = 12

/**
 * How long manual Prev/Next / swipe should pause auto-follow of the active
 * speaker. Without this pause, speaking keeps yanking the user back to page 1.
 */
export const MEETING_GALLERY_FOLLOW_RESUME_MS = 12_000

export function resolveMeetingGalleryPageSize(input: {
  basePageSize: number
  denseGallery?: boolean
  breakpoint?: string
}): number {
  const base = Math.max(1, Math.min(MEETING_GALLERY_MAX_VISIBLE, Math.floor(input.basePageSize)))
  if (!input.denseGallery) return base
  const bp = input.breakpoint ?? ''
  if (bp === 'mobile') return Math.min(MEETING_DENSE_GALLERY_PAGE_SIZE_MOBILE, MEETING_GALLERY_MAX_VISIBLE)
  if (bp === 'tablet' || bp === 'laptop') {
    return Math.min(MEETING_DENSE_GALLERY_PAGE_SIZE_TABLET, MEETING_GALLERY_MAX_VISIBLE)
  }
  return Math.min(MEETING_DENSE_GALLERY_PAGE_SIZE, MEETING_GALLERY_MAX_VISIBLE)
}

/** Split participants into visual rows for an explicit Meet-style grid. */
export function chunkGalleryRows<T>(items: T[], columns: number): T[][] {
  const cols = Math.max(columns, 1)
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols))
  }
  return rows
}

/**
 * Tile index windows for a vertically scrolling gallery. `start`/`end` (end
 * exclusive) are the tiles to mount; `visibleStart`/`visibleEnd` are on screen.
 */
export function meetingGalleryScrollWindow(input: {
  total: number
  columns: number
  rowStride: number
  scrollOffset: number
  /** Visible height; 0 before first measure. */
  viewportSize: number
  /** Rows that fit before the first measure. */
  rowsPerViewport: number
  overscanRows?: number
}): { start: number; end: number; visibleStart: number; visibleEnd: number } {
  const total = Math.max(0, Math.floor(input.total))
  const columns = Math.max(1, Math.floor(input.columns))
  const totalRows = Math.ceil(total / columns)
  const stride = Math.max(1, input.rowStride)
  const overscan = Math.max(0, Math.floor(input.overscanRows ?? 1))
  const offset = Math.max(0, input.scrollOffset)
  const firstRow = Math.min(Math.floor(offset / stride), Math.max(totalRows - 1, 0))
  const lastRow =
    input.viewportSize > 0
      ? Math.ceil((offset + input.viewportSize) / stride)
      : firstRow + Math.max(1, input.rowsPerViewport)
  const clampRow = (row: number) => Math.max(0, Math.min(totalRows, row))
  const toIndex = (row: number) => Math.min(total, clampRow(row) * columns)
  return {
    start: toIndex(firstRow - overscan),
    end: toIndex(lastRow + overscan),
    visibleStart: toIndex(firstRow),
    visibleEnd: toIndex(lastRow),
  }
}

/** Which gallery page holds `index` (0-based). */
export function meetingGalleryPageForIndex(index: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize))
  return Math.floor(Math.max(0, Math.floor(index)) / size)
}

/** Slice every page for a swipeable Zoom-style gallery pager. */
export function meetingGalleryPages<T>(items: T[], pageSize: number): T[][] {
  const size = Math.max(1, Math.floor(pageSize))
  if (items.length === 0) return [[]]
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size))
  }
  return pages
}
