import { createElement } from 'react'

import { BrandSplashFallback } from '~/components/brand/BrandSplashFallback'

declare global {
  // eslint-disable-next-line no-var
  var __SHECONOMY_SUSPENSE_FALLBACK__: ReturnType<typeof createElement> | undefined
}

/**
 * One's router wraps screens in Suspense. Register a brand logo splash so
 * async route loads never flash an empty magenta / blank frame.
 */
globalThis.__SHECONOMY_SUSPENSE_FALLBACK__ = createElement(BrandSplashFallback)
