/**
 * Rules for image URLs supplied in bulk listing import spreadsheets.
 * Bulk import references remote HTTPS images — it does not upload files.
 */

export const LISTING_IMAGE_IMPORT_CONSTRAINTS = {
  requireHttps: true,
  requireDirectImageExtension: true,
  allowedExtensions: ['jpg', 'jpeg', 'png'] as const,
} as const

export const LISTING_IMAGE_PROXY_REQUIRED_HOSTS = new Set([
  'ibb.co',
  'www.ibb.co',
  'dropbox.com',
  'www.dropbox.com',
])

export const LISTING_IMAGE_HOST_ALLOWLIST = {
  exactHosts: [
    'ibb.co',
    'www.ibb.co',
    'i.ibb.co',
    'www.dropbox.com',
    'dropbox.com',
    'storage.googleapis.com',
    's3.amazonaws.com',
    'res.cloudinary.com',
    'imgur.com',
    'www.imgur.com',
    'i.imgur.com',
    'postimg.cc',
    'www.postimg.cc',
    'i.postimg.cc',
    'imageshack.com',
    'www.imageshack.com',
    'live.staticflickr.com',
    'images.unsplash.com',
    'plus.unsplash.com',
    'images.pexels.com',
    'cdn.pixabay.com',
    'raw.githubusercontent.com',
    'user-images.githubusercontent.com',
    'supabaseusercontent.com',
    'f000.backblazeb2.com',
    'f001.backblazeb2.com',
    'f002.backblazeb2.com',
    'f003.backblazeb2.com',
    'f004.backblazeb2.com',
    'pub-images.r2.dev',
  ],
  wildcardSuffixes: [
    '.dropboxusercontent.com',
    '.s3.amazonaws.com',
    '.storage.googleapis.com',
    '.supabaseusercontent.com',
    '.backblazeb2.com',
    '.r2.dev',
    '.cloudflareimages.com',
    '.imageshack.com',
    '.staticflickr.com',
  ],
} as const

export const SUPPORTED_LISTING_IMAGE_HOST_PROVIDERS = [
  'ImgBB — ibb.co',
  'Dropbox — dropbox.com',
  'Google Cloud Storage — storage.googleapis.com',
  'AWS S3 — s3.amazonaws.com or <bucket>.s3.amazonaws.com',
  'Cloudinary — res.cloudinary.com',
  'Imgur — imgur.com',
  'Postimages — postimg.cc',
  'Flickr — live.staticflickr.com',
  'Unsplash — images.unsplash.com',
  'Pexels — images.pexels.com',
  'Pixabay — cdn.pixabay.com',
  'GitHub Raw — raw.githubusercontent.com',
  'Supabase Storage — *.supabaseusercontent.com',
  'Backblaze B2 — *.backblazeb2.com',
  'Cloudflare R2 — *.r2.dev',
] as const

function normalizeHost(hostname: string) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
}

export function isAllowedListingImageHost(hostname: string) {
  const host = normalizeHost(hostname)
  if (!host) return false
  if (LISTING_IMAGE_HOST_ALLOWLIST.exactHosts.includes(host)) return true
  return LISTING_IMAGE_HOST_ALLOWLIST.wildcardSuffixes.some((suffix) => host.endsWith(suffix))
}

export function extractListingImageExtension(pathname = '') {
  const cleanPath = pathname.toLowerCase().split('?')[0].split('#')[0]
  const extension = cleanPath.split('.').pop()
  return extension || ''
}

export function isAllowedListingImageExtension(extension: string) {
  if (!extension) return false
  return LISTING_IMAGE_IMPORT_CONSTRAINTS.allowedExtensions.includes(
    String(extension).toLowerCase() as (typeof LISTING_IMAGE_IMPORT_CONSTRAINTS.allowedExtensions)[number],
  )
}

export function validateImportedListingImageUrl(
  imageUrl: string,
  { enforceHostAllowlist = true } = {},
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!imageUrl || typeof imageUrl !== 'string') {
    return { valid: false, errors: ['Image URL is missing.'] }
  }

  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return { valid: false, errors: ['Image URL is invalid.'] }
  }

  if (LISTING_IMAGE_IMPORT_CONSTRAINTS.requireHttps && parsed.protocol.toLowerCase() !== 'https:') {
    errors.push('Image URL must use https:// (http:// is not allowed).')
  }

  if (enforceHostAllowlist && !isAllowedListingImageHost(parsed.hostname)) {
    errors.push(
      'Image host is not supported. Use one of the approved providers listed in the template Rules sheet.',
    )
  }

  if (LISTING_IMAGE_IMPORT_CONSTRAINTS.requireDirectImageExtension) {
    const extension = extractListingImageExtension(parsed.pathname)
    if (!isAllowedListingImageExtension(extension)) {
      const extensionList = LISTING_IMAGE_IMPORT_CONSTRAINTS.allowedExtensions
        .map((ext) => `.${ext}`)
        .join(', ')
      errors.push(
        `Image URL must be a direct file link ending with ${extensionList}. Page links or HTML links are not allowed.`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

export function getListingImageImportRuleMessages() {
  const extensionList = LISTING_IMAGE_IMPORT_CONSTRAINTS.allowedExtensions
    .map((ext) => `.${ext}`)
    .join(', ')

  return [
    'Image URLs must use https:// only.',
    `Image URLs must be direct file links ending with ${extensionList}.`,
    'Image page links (for example, an HTML preview page) are not accepted.',
    'Image host must be from the approved provider list in the Rules sheet.',
  ] as const
}

export function getListingImageImportTemplateRuleRows() {
  const extensionList = LISTING_IMAGE_IMPORT_CONSTRAINTS.allowedExtensions
    .map((ext) => `.${ext}`)
    .join(', ')

  return [
    {
      area: 'Images',
      rule: 'Protocol',
      requirement: 'Use HTTPS URLs only',
      allowed: 'https://',
      notAllowed: 'http://',
    },
    {
      area: 'Images',
      rule: 'File type',
      requirement: 'Use direct image file URLs',
      allowed: extensionList,
      notAllowed: 'HTML page links, preview links, or URLs without image extension',
    },
    {
      area: 'Images',
      rule: 'Host allowlist',
      requirement: 'Image host must be approved',
      allowed: SUPPORTED_LISTING_IMAGE_HOST_PROVIDERS.join('; '),
      notAllowed: 'Unlisted hosts',
    },
  ] as const
}
