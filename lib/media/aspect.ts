/** Shared media aspect ratios used across avatar, cover, listing, celebration, etc. */
export type MediaAspectPreset =
  | 'free'
  | 'square'
  | 'avatar'
  | 'cover'
  | 'landscape'
  | 'portrait'
  | 'story'
  | 'listing'
  | 'celebration'
  | 'banner'

export type AspectRatioTuple = readonly [number, number]

export const MEDIA_ASPECT_RATIOS: Record<Exclude<MediaAspectPreset, 'free'>, AspectRatioTuple> = {
  square: [1, 1],
  avatar: [1, 1],
  cover: [3, 1],
  landscape: [16, 9],
  portrait: [4, 5],
  story: [9, 16],
  listing: [1, 1],
  celebration: [16, 9],
  banner: [8, 3],
}

export function resolveAspectRatio(
  aspect?: MediaAspectPreset | AspectRatioTuple | null,
): AspectRatioTuple | null {
  if (!aspect || aspect === 'free') return null
  if (Array.isArray(aspect)) return aspect
  return MEDIA_ASPECT_RATIOS[aspect] ?? null
}

export function aspectLabel(aspect: AspectRatioTuple | null): string | null {
  if (!aspect) return null
  const [w, h] = aspect
  if (w === h) return '1:1'
  return `${w}:${h}`
}
