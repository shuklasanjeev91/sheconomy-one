import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { buildAbsoluteUrl } from '~/lib/platform/url'

type SeoContextValue = {
  setOverride: (seo: PageSeo) => void
  clearOverride: () => void
}

const SeoContext = createContext<SeoContextValue | null>(null)

/**
 * Provides route-wise SEO defaults and renders the head tags exactly once.
 * React 19 hoists `<title>` / `<meta>` / `<link>` into `<head>` on web
 * (including SSR); on native this renders nothing.
 */
export function RouteSeoProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<PageSeo | null>(null)

  const setOverride = useCallback((seo: PageSeo) => {
    setOverrideState((current) => {
      if (
        current &&
        current.title === seo.title &&
        current.description === seo.description &&
        current.image === seo.image &&
        current.type === seo.type &&
        current.noindex === seo.noindex &&
        current.canonicalPath === seo.canonicalPath
      ) {
        return current
      }
      return seo
    })
  }, [])

  const clearOverride = useCallback(() => setOverrideState(null), [])

  const value = useMemo(() => ({ setOverride, clearOverride }), [setOverride, clearOverride])

  return (
    <SeoContext.Provider value={value}>
      {Platform.OS === 'web' ? <RouteSeoTags override={override} /> : null}
      {children}
    </SeoContext.Provider>
  )
}

function RouteSeoTags({ override }: { override: PageSeo | null }) {
  const pathname = usePathname()
  // Post detail SSR pages render `DocumentSeoTags` with the real `og:image`.
  // Skip generic defaults here so crawlers (WhatsApp) don't latch onto the
  // first tag — which would be `/app-icon.png` instead of the post photo.
  if (!override && pathname?.startsWith('/community/post/')) {
    return null
  }

  const defaults = resolveRouteSeo(pathname)
  const seo = override ?? defaults

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
 */
export function usePageSeo(seo: PageSeo | null | undefined) {
  const context = useContext(SeoContext)

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
