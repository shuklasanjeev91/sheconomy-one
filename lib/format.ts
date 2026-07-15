function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateCardTitle(value: string, max = 72): string {
  const clean = value.trim()
  if (clean.length <= max) return clean

  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function cleanSeoTitle(value: string): string {
  return value
    .replace(/^(Order|Buy|Shop)\s+/i, '')
    .replace(/\s+Online$/i, '')
    .trim()
}

function isDescriptionLikeTitle(title: string): boolean {
  if (title.length > 80) return true
  if (/^(This|The|A|An)\s+[a-z]/i.test(title)) return true
  return title.includes(' for ') && title.length > 50
}

function titleFromDescription(description: string): string | null {
  const desc = stripHtml(description)
  if (!desc) return null

  const titled = desc.match(/^Title\s*:\s*(.+?)(?:\s*\||\n|$)/i)?.[1]?.trim()
  if (titled) return titled

  const productName = desc.match(/Product Name\s*:\s*(.+?)(?:\n|$)/i)?.[1]?.trim()
  if (productName) return productName

  return null
}

/** Short product name for listing tiles — never the full marketing description. */
export function getListingCardTitle(listing: {
  title: string
  meta_title?: string | null
  description?: string | null
}): string {
  const rawTitle = stripHtml(listing.title ?? '')
  const titleCandidate = truncateCardTitle(
    rawTitle.split('|')[0]?.split(/\r?\n/)[0]?.trim() || rawTitle,
  )

  const metaCandidate = cleanSeoTitle(stripHtml(listing.meta_title ?? ''))

  if (titleCandidate && !isDescriptionLikeTitle(rawTitle)) {
    return titleCandidate
  }

  if (metaCandidate) {
    return truncateCardTitle(metaCandidate)
  }

  if (titleCandidate) {
    return titleCandidate
  }

  const fromDescription = titleFromDescription(listing.description ?? '')
  if (fromDescription) {
    return truncateCardTitle(fromDescription)
  }

  return 'Listing'
}

/**
 * Format a money amount. Pass `locale` (e.g. en-US) to match the shopper's
 * region preferences; defaults remain en-IN / INR for home market.
 */
export function formatCurrency(amount: number, currency = 'INR', locale = 'en-IN') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount)
  }
}

export function formatRating(rating: number | string | null | undefined) {
  if (rating == null || rating === '') return '—'
  const value = Number(rating)
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}
