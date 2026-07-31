import { createElement } from 'react'

import { NativeBootPlaceholder } from '~/components/brand/NativeBootPlaceholder'

declare global {
  // eslint-disable-next-line no-var
  var __SHECONOMY_SUSPENSE_FALLBACK__: ReturnType<typeof createElement> | undefined
}

/**
 * Suspense fallback must NOT use Tamagui (Missing theme) and must NOT be the
 * brand-magenta splash — that read as a stuck blank unwanted screen on native.
 */
globalThis.__SHECONOMY_SUSPENSE_FALLBACK__ = createElement(NativeBootPlaceholder)
