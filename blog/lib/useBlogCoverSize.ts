import { useWindowDimensions } from 'react-native'

import { useAppLayout } from '~/hooks/useAppLayout'

export type BlogCoverSize = {
  /** Render width inside the article column */
  width: number
  /** Cover frame height */
  height: number
  /** CSS aspect ratio string for web */
  aspectRatio: number
}

/**
 * Responsive cover size for blog detail:
 * - phone: ~16:10, shorter
 * - tablet: medium
 * - desktop: taller hero still capped
 */
export function useBlogCoverSize(articleMaxWidth: number): BlogCoverSize {
  const { width: viewportW } = useWindowDimensions()
  const { isDesktop, isTablet, gutter } = useAppLayout()

  const available = Math.max(280, Math.min(articleMaxWidth, viewportW - gutter * 2))

  if (isDesktop) {
    const height = Math.round(Math.min(360, Math.max(280, available * 0.48)))
    return { width: available, height, aspectRatio: available / height }
  }

  if (isTablet) {
    const height = Math.round(Math.min(280, Math.max(220, available * 0.5)))
    return { width: available, height, aspectRatio: available / height }
  }

  const height = Math.round(Math.min(220, Math.max(160, available * 0.56)))
  return { width: available, height, aspectRatio: available / height }
}
