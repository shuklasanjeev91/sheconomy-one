export type GalleryLayout = {
  columns: number
  rows: number
}

export type GalleryLayoutOptions = {
  /** Usable stage width in px (after chrome / padding). */
  width: number
  /** Usable stage height in px (after chrome / padding). */
  height: number
}

/**
 * Responsive gallery grid — Google Meet / Zoom / WhatsApp-call style.
 *
 * Uses the real stage aspect so portrait tablets (e.g. iPad) never collapse
 * 3 participants into three tall skinny columns.
 *
 * Typical results on portrait stage:
 * - 1: full stage
 * - 2: side-by-side on tablet+ / stacked on narrow phones
 *   (1:1 LiveKit calls use WhatsApp-style PiP instead of this grid)
 * - 3: balanced 2×2-style gallery (one centered final tile)
 * - 4: 2×2
 * - 5–6: 2×3
 * - 7–9: 3×3 when wide enough, else 2×N
 *
 * Landscape / wide stage may use 3 across for 3 people and 3–4 columns for larger groups.
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
  const wideLandscape = aspect >= 1.45 && width >= 900

  if (count === 2) {
    // Phones: stacked like WhatsApp. Tablets / landscape: Meet-style equal tiles.
    return narrowPortrait ? { columns: 1, rows: 2 } : { columns: 2, rows: 1 }
  }

  if (count === 3) {
    // Zoom-style gallery: avoid three shallow full-width strips on phones,
    // which crop portrait cameras to eyes/foreheads. Wide stages fit one row.
    if (wideLandscape) return { columns: 3, rows: 1 }
    return { columns: 2, rows: 2 }
  }

  if (count === 4) return { columns: 2, rows: 2 }

  if (count <= 6) {
    if (width >= 700 && aspect >= 0.95) return { columns: 3, rows: 2 }
    return { columns: 2, rows: 3 }
  }

  if (count <= 9) {
    if (width >= 800) return { columns: 3, rows: 3 }
    return { columns: 2, rows: Math.ceil(count / 2) }
  }

  const columns = width >= 1100 ? 4 : width >= 800 ? 3 : 2
  return { columns, rows: Math.ceil(count / columns) }
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
