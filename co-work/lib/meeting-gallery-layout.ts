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

/** Desktop dense gallery page size (7×7) when the host enables More → Dense gallery. */
export const MEETING_DENSE_GALLERY_PAGE_SIZE = 49

export function resolveMeetingGalleryPageSize(input: {
  basePageSize: number
  denseGallery?: boolean
  breakpoint?: string
}): number {
  if (
    input.denseGallery &&
    (input.breakpoint === 'desktop' || input.breakpoint === 'large-desktop')
  ) {
    return MEETING_DENSE_GALLERY_PAGE_SIZE
  }
  return Math.max(1, input.basePageSize)
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
