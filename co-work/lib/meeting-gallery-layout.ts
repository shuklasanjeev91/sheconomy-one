export type GalleryLayout = {
  columns: number
  rows: number
}

export type GalleryLayoutOptions = {
  /** Usable stage width in px (after chrome / padding). */
  width: number
  /** Usable stage height in px (after chrome / padding). */
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

/** Identities on the current page plus neighbors so swipe/prev-next has video ready. */
export function meetingGalleryPrefetchIdentities<T extends { participant: { identity: string } }>(
  tracks: T[],
  page: number,
  pageSize: number,
): string[] {
  const size = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(tracks.length / size))
  const safePage = Math.min(Math.max(0, Math.floor(page)), pageCount - 1)
  const start = Math.max(0, (safePage - 1) * size)
  const end = Math.min(tracks.length, (safePage + 2) * size)
  const identities = new Set<string>()
  for (let i = start; i < end; i += 1) {
    const track = tracks[i]
    if (track) identities.add(track.participant.identity)
  }
  return [...identities]
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

export function paginateMeetingGallery<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; pageCount: number } {
  const size = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const safePage = Math.min(Math.max(0, Math.floor(page)), pageCount - 1)
  return {
    items: items.slice(safePage * size, safePage * size + size),
    page: safePage,
    pageCount,
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
