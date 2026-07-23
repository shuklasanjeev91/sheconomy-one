/**
 * Visual commerce preview eligibility: clothes try-on vs view-in-space.
 * Category heuristics + optional listing_metadata.visual_preview override.
 */

export type VisualPreviewMode = 'try_on' | 'view_in_space'

export type VisualPreviewPlacement = 'wall' | 'floor' | 'table'

export type VisualPreviewListingLike = {
  category?: string | null
  tags?: string[] | null
  listing_metadata?: Record<string, unknown> | null
  /** True when the listing has at least one usable product image. */
  hasPrimaryImage?: boolean
}

const TRY_ON_KEYWORDS = [
  'fashion',
  'clothing',
  'apparel',
  'dress',
  'wear',
  'saree',
  'sari',
  'kurti',
  'kurta',
  'lehenga',
  'blouse',
  'shirt',
  'top',
  'tee',
  't-shirt',
  'jeans',
  'trouser',
  'pant',
  'skirt',
  'gown',
  'jacket',
  'coat',
  'sweater',
  'hoodie',
  'ethnic',
  'western wear',
  'activewear',
  'lingerie',
  'nightwear',
  'footwear',
  'shoe',
  'sandal',
  'sneaker',
  'heel',
  'suit',
  'unstitched',
  'fabric',
]

const VIEW_IN_SPACE_KEYWORDS = [
  'electronic',
  'electronics',
  'appliance',
  'tv',
  'television',
  'monitor',
  'speaker',
  'furniture',
  'sofa',
  'chair',
  'table',
  'desk',
  'bed',
  'mattress',
  'cabinet',
  'shelf',
  'home decor',
  'decor',
  'decoration',
  'wall art',
  'painting',
  'poster',
  'frame',
  'mirror',
  'lamp',
  'lighting',
  'rug',
  'carpet',
  'curtain',
  'home & living',
  'home and living',
  'kitchen',
  'refrigerator',
  'washing machine',
  'ac ',
  'air conditioner',
]

function haystackFromListing(listing: VisualPreviewListingLike): string {
  const parts: string[] = []
  if (listing.category) parts.push(String(listing.category))
  if (Array.isArray(listing.tags)) {
    for (const tag of listing.tags) {
      if (tag) parts.push(String(tag))
    }
  }
  return parts.join(' ').toLowerCase()
}

function matchesKeywords(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
}

function metadataOverride(listing: VisualPreviewListingLike): VisualPreviewMode | null {
  const meta = listing.listing_metadata
  if (!meta || typeof meta !== 'object') return null
  const raw = meta.visual_preview
  if (raw === 'try_on' || raw === 'view_in_space') return raw
  return null
}

/**
 * Resolve which visual preview mode (if any) applies to a listing.
 * Metadata override wins; otherwise category/tag keywords decide.
 */
export function resolveVisualPreviewMode(
  listing: VisualPreviewListingLike,
): VisualPreviewMode | null {
  if (listing.hasPrimaryImage === false) return null

  const override = metadataOverride(listing)
  if (override) return override

  const haystack = haystackFromListing(listing)
  if (!haystack.trim()) return null

  // Prefer try-on when apparel signals are present (even if "home" appears in tags).
  if (matchesKeywords(haystack, TRY_ON_KEYWORDS)) return 'try_on'
  if (matchesKeywords(haystack, VIEW_IN_SPACE_KEYWORDS)) return 'view_in_space'
  return null
}

export function isVisualPreviewEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_VISUAL_PREVIEW_ENABLED
  if (flag == null || flag === '') return true
  return flag !== '0' && flag.toLowerCase() !== 'false'
}

export function visualPreviewPrompt(
  mode: VisualPreviewMode,
  placement: VisualPreviewPlacement = 'wall',
): string {
  if (mode === 'try_on') {
    return [
      'You are generating a virtual try-on preview for an online store.',
      'Image 1 is a photo of a person. Image 2 is a clothing/product photo.',
      'Generate a photorealistic image of the person from image 1 wearing the garment from image 2.',
      'Preserve the person\'s face, body pose, skin tone, and background as closely as possible.',
      'Fit the garment naturally with realistic lighting and fabric folds.',
      'Do not add logos, watermarks, or text overlays.',
      'Output only the edited photo.',
    ].join(' ')
  }

  const placementHint =
    placement === 'wall'
      ? 'Mount or hang the product on a suitable wall surface in the room, with correct perspective.'
      : placement === 'floor'
        ? 'Place the product on the floor in a natural spot with correct scale and perspective.'
        : 'Place the product on a table or surface in the room with correct scale and perspective.'

  return [
    'You are generating a "view in your room" product preview for an online store.',
    'Image 1 is a photo of a real room or wall. Image 2 is the product.',
    'Generate a photorealistic image that places the product from image 2 into the room from image 1.',
    placementHint,
    'Match lighting, shadows, and perspective so the product looks physically present.',
    'Do not invent a different room; keep the original space recognizable.',
    'Do not add logos, watermarks, or text overlays.',
    'Output only the edited photo.',
  ].join(' ')
}
