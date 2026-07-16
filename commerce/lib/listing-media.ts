import { isVideoMediaUrl } from '~/community/lib/post-media'

export type ListingMediaKind = 'image' | 'video'

/** Resolve gallery item kind from DB `image_type` or URL heuristics. */
export function listingMediaKind(
  url: string,
  imageType?: string | null,
): ListingMediaKind {
  const type = (imageType ?? '').toLowerCase()
  if (type === 'video' || type.startsWith('video/')) return 'video'
  if (isVideoMediaUrl(url)) return 'video'
  return 'image'
}
