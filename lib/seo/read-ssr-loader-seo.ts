import { peekSsrPageSeo } from '~/lib/seo/ssr-page-seo-slot'
import type { PageSeo } from '~/lib/seo/seo'

/**
 * Read page SEO published by SSR loaders (e.g. `postSeoLoader`).
 *
 * Post routes can suspend before `usePageSeo` runs, so RouteSeoTags uses this
 * during SSR for crawlers (WhatsApp / Facebook) that need `og:image` in HTML.
 */
export function readSsrLoaderPageSeo(): PageSeo | null {
  if (typeof window !== 'undefined') return null

  const fromLoader = peekSsrPageSeo()
  if (fromLoader) return fromLoader

  try {
    const globalIdKey = '__oneGlobalContextId'
    const serverContextsKey = '__oneServerContexts'
    const ctxKey = Symbol.for('__oneCtx')

    const store = (globalThis as { __vxrnrequestAsyncLocalStore?: { getStore?: () => unknown } })
      .__vxrnrequestAsyncLocalStore
    const id = (
      process.env.VERCEL ? (globalThis as Record<string, unknown>)[globalIdKey] : store?.getStore?.()
    ) as { [k: symbol]: { loaderData?: { seo?: PageSeo } } | undefined } | null | undefined

    if (!id) return null

    const fromId = id[ctxKey]
    const contexts = (globalThis as Record<string, WeakMap<object, { loaderData?: { seo?: PageSeo } }>>)[
      serverContextsKey
    ]
    const ctx = fromId || (id && contexts?.get?.(id as object))
    const seo = ctx?.loaderData?.seo
    if (seo && typeof seo === 'object' && typeof seo.title === 'string') {
      return seo
    }
  } catch {
    // Not in an SSR request — ignore.
  }

  return null
}
