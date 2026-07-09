export type GalleryLayout = {
  columns: number
  rows: number
}

/** Responsive gallery grid — Zoom/Meet style. */
export function meetingGalleryLayout(
  trackCount: number,
  options: { isDesktop: boolean; isLandscape: boolean },
): GalleryLayout {
  const { isDesktop, isLandscape } = options

  if (trackCount <= 1) return { columns: 1, rows: 1 }
  if (trackCount === 2) {
    return isDesktop || isLandscape ? { columns: 2, rows: 1 } : { columns: 1, rows: 2 }
  }
  if (trackCount <= 4) return { columns: 2, rows: 2 }
  if (trackCount <= 6) return { columns: 3, rows: 2 }
  if (trackCount <= 9) return { columns: 3, rows: 3 }
  return { columns: 4, rows: 3 }
}
