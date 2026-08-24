import { SITE_NAME, buildPageTitle, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, type PageSeo } from '~/lib/seo/seo'
import { buildAbsoluteUrl } from '~/lib/platform/url'

type DocumentSeoTagsProps = {
  seo: PageSeo
  /** Absolute canonical URL. Defaults from `seo.canonicalPath`. */
  url?: string
}

/**
 * SSR-safe Open Graph / Twitter tags. Rendered as real elements so crawlers
 * (WhatsApp, Facebook, LinkedIn, …) see `og:image` in the initial HTML —
 * client-only `usePageSeo` updates are invisible to those bots.
 */
export function DocumentSeoTags({ seo, url }: DocumentSeoTagsProps) {
  const title = buildPageTitle(seo.title)
  const description = (seo.description ?? DEFAULT_DESCRIPTION).slice(0, 300)
  const canonicalUrl = url || buildAbsoluteUrl(seo.canonicalPath ?? '/')
  const rawImage = seo.image || DEFAULT_OG_IMAGE
  const imageUrl = rawImage.startsWith('http') ? rawImage : buildAbsoluteUrl(rawImage)
  const ogType = seo.type ?? 'website'

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {seo.noindex ? <meta name="robots" content="noindex, nofollow" /> : null}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:alt" content={title} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  )
}
