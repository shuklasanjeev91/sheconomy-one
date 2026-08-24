import type { PageSeo } from '~/lib/seo/seo'

const SSR_PAGE_SEO_KEY = '__sheconomySsrPageSeo'

/** Publish SEO from an SSR loader before the route tree finishes rendering. */
export function publishSsrPageSeo(seo: PageSeo | null) {
  if (typeof window !== 'undefined') return
  if (seo) {
    ;(globalThis as Record<string, PageSeo | null>)[SSR_PAGE_SEO_KEY] = seo
  } else {
    delete (globalThis as Record<string, PageSeo | null>)[SSR_PAGE_SEO_KEY]
  }
}

/** Read SEO published by `publishSsrPageSeo` (SSR only). */
export function peekSsrPageSeo(): PageSeo | null {
  if (typeof window !== 'undefined') return null
  const seo = (globalThis as Record<string, PageSeo | undefined>)[SSR_PAGE_SEO_KEY]
  return seo && typeof seo.title === 'string' ? seo : null
}
