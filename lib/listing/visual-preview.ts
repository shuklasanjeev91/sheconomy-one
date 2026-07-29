/**
 * Visual commerce preview eligibility: fashion try-on vs Amazon-style view-in-space.
 * Category / title / tag heuristics + optional listing_metadata.visual_preview override.
 */

export type VisualPreviewMode = 'try_on' | 'view_in_space'

export type VisualPreviewPlacement = 'wall' | 'floor' | 'table'

export type VisualPreviewListingLike = {
  category?: string | null
  title?: string | null
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
  'dupatta',
  'salwar',
  'anarkali',
  'sherwani',
  'shirt',
  'top',
  'tee',
  't-shirt',
  'tshirt',
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
  'sleepwear',
  'footwear',
  'shoe',
  'sandal',
  'sneaker',
  'heel',
  'boot',
  'suit',
  'blazer',
  'unstitched',
  'fabric',
  'outfit',
  'garment',
  'attire',
  'sleeves',
  'neckline',
  'jumpsuit',
  'romper',
  'scarf',
  'stole',
  'shawl',
]

const VIEW_IN_SPACE_KEYWORDS = [
  'electronic',
  'electronics',
  'appliance',
  'tv',
  'television',
  'monitor',
  'speaker',
  'soundbar',
  'furniture',
  'sofa',
  'chair',
  'table',
  'desk',
  'bed',
  'mattress',
  'cabinet',
  'shelf',
  'bookshelf',
  'home decor',
  'homedecor',
  'decor',
  'decoration',
  'wall art',
  'wallart',
  'painting',
  'poster',
  'canvas',
  'frame',
  'mirror',
  'lamp',
  'lighting',
  'chandelier',
  'rug',
  'carpet',
  'mat',
  'curtain',
  'blinds',
  'home & living',
  'home and living',
  'home living',
  'kitchen',
  'refrigerator',
  'fridge',
  'washing machine',
  'ac ',
  'air conditioner',
  'vase',
  'planter',
  'plant pot',
  'cushion',
  'pillow',
  'ottoman',
  'sideboard',
  'console',
]

/** Products that typically hang / mount on a wall (Amazon “View in your room”). */
const WALL_KEYWORDS = [
  'tv',
  'television',
  'monitor',
  'wall art',
  'wallart',
  'painting',
  'poster',
  'canvas',
  'frame',
  'mirror',
  'photo frame',
  'clock',
  'shelf',
  'floating shelf',
  'soundbar',
  'curtain',
  'blinds',
  'wall hanging',
  'wallpaper',
]

/** Products that usually sit on the floor. */
const FLOOR_KEYWORDS = [
  'sofa',
  'couch',
  'chair',
  'armchair',
  'recliner',
  'bed',
  'mattress',
  'rug',
  'carpet',
  'mat',
  'desk',
  'table',
  'dining',
  'cabinet',
  'bookshelf',
  'wardrobe',
  'ottoman',
  'bean bag',
  'stool',
  'refrigerator',
  'fridge',
  'washing machine',
  'plant',
  'planter',
  'floor lamp',
]

/** Products that usually sit on a table / shelf surface. */
const TABLE_KEYWORDS = [
  'lamp',
  'table lamp',
  'vase',
  'candle',
  'speaker',
  'bluetooth speaker',
  'clock',
  'decor',
  'figurine',
  'sculpture',
  'bowl',
  'tray',
  'plant pot',
  'cushion',
  'pillow',
]

function haystackFromListing(listing: VisualPreviewListingLike): string {
  const parts: string[] = []
  if (listing.category) parts.push(String(listing.category))
  if (listing.title) parts.push(String(listing.title))
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
 * Metadata override wins; otherwise category/title/tag keywords decide.
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

/**
 * Amazon-style default placement for view-in-space products.
 * Fashion try-on ignores this.
 */
export function suggestVisualPreviewPlacement(
  listing: VisualPreviewListingLike,
): VisualPreviewPlacement {
  const meta = listing.listing_metadata
  if (meta && typeof meta === 'object') {
    const raw = meta.visual_placement
    if (raw === 'wall' || raw === 'floor' || raw === 'table') return raw
  }

  const haystack = haystackFromListing(listing)
  if (matchesKeywords(haystack, WALL_KEYWORDS)) return 'wall'
  // Table accents before floor — otherwise “table lamp” matches the floor “table” keyword.
  if (matchesKeywords(haystack, TABLE_KEYWORDS)) return 'table'
  if (matchesKeywords(haystack, FLOOR_KEYWORDS)) return 'floor'
  // Sensible Amazon-like default for generic home/electronics.
  if (matchesKeywords(haystack, ['tv', 'television', 'art', 'mirror', 'frame'])) return 'wall'
  return 'floor'
}

export function isVisualPreviewEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_VISUAL_PREVIEW_ENABLED
  if (flag == null || flag === '') return true
  return flag !== '0' && flag.toLowerCase() !== 'false'
}

export function visualPreviewPrompt(
  mode: VisualPreviewMode,
  placement: VisualPreviewPlacement = 'wall',
  options?: { title?: string | null; category?: string | null },
): string {
  const productHint = [options?.title, options?.category]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' · ')

  if (mode === 'try_on') {
    return [
      'Create a photorealistic virtual try-on preview for an online fashion store (like Amazon Try On).',
      'Image 1 is the shopper. Image 2 is the fashion product to wear.',
      productHint ? `Product context: ${productHint}.` : '',
      'Generate one image of the person from Image 1 wearing the garment/accessory from Image 2.',
      "Keep the person's face, skin tone, body proportions, pose, hair, and background unchanged.",
      'Replace or drape only the relevant clothing so fit, fabric texture, color, and lighting look natural.',
      'No logos, watermarks, text, extra people, or mannequins.',
      'Output only the edited photo.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const placementHint =
    placement === 'wall'
      ? 'Place/mount the product on a suitable wall in the room (correct height, perspective, and slight contact shadow).'
      : placement === 'floor'
        ? 'Place the product on the floor in a natural spot with realistic scale, perspective, and ground shadow.'
        : 'Place the product on a table, shelf, or surface with realistic scale, perspective, and contact shadow.'

  return [
    'Create a photorealistic “View in your room” preview for an online store (like Amazon View in your room).',
    'Image 1 is the customer’s room / wall photo. Image 2 is the product.',
    productHint ? `Product context: ${productHint}.` : '',
    'Composite the product from Image 2 into Image 1 so it looks physically present.',
    placementHint,
    'Match lighting, white balance, shadows, and perspective. Keep the original room recognizable — do not invent a different space.',
    'Remove product studio backgrounds; no logos, watermarks, or text overlays.',
    'Output only the edited photo.',
  ]
    .filter(Boolean)
    .join(' ')
}

export const VISUAL_PLACEMENT_OPTIONS: Array<{
  id: VisualPreviewPlacement
  label: string
  hint: string
}> = [
  { id: 'wall', label: 'Wall', hint: 'Hang or mount on a wall' },
  { id: 'floor', label: 'Floor', hint: 'Place on the floor' },
  { id: 'table', label: 'Table', hint: 'Set on a table or shelf' },
]
