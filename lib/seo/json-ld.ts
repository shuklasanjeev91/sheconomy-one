import { DEFAULT_DESCRIPTION, SITE_NAME } from '~/lib/seo/seo'
import { buildAbsoluteUrl } from '~/lib/platform/url'

function absoluteImage(image: string | null | undefined): string | undefined {
  const trimmed = image?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return buildAbsoluteUrl(trimmed)
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: buildAbsoluteUrl('/'),
    logo: buildAbsoluteUrl('/brand-logo-1024.png'),
    description: DEFAULT_DESCRIPTION,
  }
}

export function productJsonLd(input: {
  name: string
  description?: string | null
  image?: string | null
  url: string
  price: number
  currency?: string | null
  inStock: boolean
}) {
  const image = absoluteImage(input.image)
  const description = input.description?.trim()
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    url: input.url,
    offers: {
      '@type': 'Offer',
      url: input.url,
      priceCurrency: input.currency?.trim() || 'INR',
      price: String(input.price),
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
}
