import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import {
  buildPageTitle,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  resolveRouteSeo,
  SITE_NAME,
  type PageSeo,
} from '~/lib/seo/seo'
import { readSsrLoaderPageSeo } from '~/lib/seo/read-ssr-loader-seo'
import { buildAbsoluteUrl } from '~/lib/platform/url'

type SeoContextValue = {
  /** Write SEO for this render pass (SSR-safe; no setState). */
  primeOverride: (seo: PageSeo) => void
  setOverride: (seo: PageSeo) => void
  clearOverride: () => void
}

const SeoContext = createContext<SeoContextValue | null>(null)

function seoEqual(a: PageSeo, b: PageSeo) {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.image === b.image &&
    a.type === b.type &&
    a.noindex === b.noindex &&
    a.canonicalPath === b.canonicalPath
  )
}

/**
 * Provides route-wise SEO defaults and renders the head tags exactly once.
 * React 19 hoists `<title>` / `<meta>` / `<link>` into `<head>` on web
 * (including SSR); on native this renders nothing.
 *
 * Children render before tags so `usePageSeo` can prime OG data during the
 * same SSR pass (effects do not run on the server).
 */
export function RouteSeoProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<PageSeo | null>(null)
  /** Reset each provider render; children re-prime during this pass. */
  const primedThisPass = useRef<PageSeo | null>(null)
  primedThisPass.current = null

  const primeOverride = useCallback((seo: PageSeo) => {
    primedThisPass.current = seo
  }, [])

  const setOverride = useCallback((seo: PageSeo) => {
    primedThisPass.current = seo
    setOverrideState((current) => {
      if (current && seoEqual(current, seo)) return current
      return seo
    })
  }, [])

  const clearOverride = useCallback(() => {
    primedThisPass.current = null
    setOverrideState(null)
  }, [])

  const value = useMemo(
    () => ({ primeOverride, setOverride, clearOverride }),
    [primeOverride, setOverride, clearOverride],
  )

  return (
    <SeoContext.Provider value={value}>
      {children}
      {Platform.OS === 'web' ? (
        // Read primed SEO during THIS component's render (after children), not
        // when the element is created — otherwise the ref is still empty.
        <RouteSeoTags getOverride={() => primedThisPass.current ?? override} />
      ) : null}
    </SeoContext.Provider>
  )
}

function RouteSeoTags({ getOverride }: { getOverride: () => PageSeo | null }) {
  const pathname = usePathname()
  const override = getOverride()
  const ssrLoaderSeo = readSsrLoaderPageSeo()
  const defaults = resolveRouteSeo(pathname)
  const seo = override ?? ssrLoaderSeo ?? defaults

  const title = buildPageTitle(seo.title)
  const description = (seo.description ?? DEFAULT_DESCRIPTION).slice(0, 300)
  const canonicalUrl = buildAbsoluteUrl(seo.canonicalPath ?? pathname ?? '/')
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

/**
 * Screens with richer data (listing title, shop name, post snippet, …) call
 * this to override the route defaults while mounted. Pass `null` while the
 * data is still loading to keep the defaults.
 *
 * Primes during render so SSR HTML includes the correct `og:image` (WhatsApp
 * and other crawlers never run client effects).
 */
export function usePageSeo(seo: PageSeo | null | undefined) {
  const context = useContext(SeoContext)

  if (context && Platform.OS === 'web' && seo) {
    context.primeOverride(seo)
  }

  useEffect(() => {
    if (!context || Platform.OS !== 'web') return
    if (!seo) return
    context.setOverride(seo)
  }, [
    context,
    seo?.title,
    seo?.description,
    seo?.image,
    seo?.type,
    seo?.noindex,
    seo?.canonicalPath,
  ])

  useEffect(() => {
    if (!context || Platform.OS !== 'web') return
    return () => context.clearOverride()
  }, [context])
}
