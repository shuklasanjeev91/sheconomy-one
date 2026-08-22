import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
} from '~/lib/routes'
import { scheduleIdle } from '~/lib/schedule-idle'

type WarmImport = () => Promise<unknown>

/** Screen modules for each product-root tab — shared by idle warmup and press-in prefetch. */
const PRODUCT_TAB_WARM_IMPORTS: Record<string, WarmImport> = {
  [String(commerceRoutes.home)]: () => import('~/commerce/screens/HomeScreen'),
  [String(communityRoutes.home)]: () => import('~/community/screens/CommunityFeedScreen'),
  [String(chatRoutes.home)]: () => import('~/chat/screens/ChatScreen'),
  [String(classRoutes.home)]: () => import('~/class/screens/ClassesScreen'),
  [String(coWorkRoutes.home)]: () => import('~/co-work/screens/CoWorkScreen'),
}

const PRIMARY_TAB_PATHS = new Set([String(commerceRoutes.home), String(communityRoutes.home)])

const DEFERRED_TAB_PATHS = [
  String(chatRoutes.home),
  String(classRoutes.home),
  String(coWorkRoutes.home),
]

function normalizeTabPath(href: string): string {
  const [path = '/'] = href.split('?')
  const trimmed = path.replace(/\/$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** Fire-and-forget dynamic import for a product tab route (safe to call repeatedly). */
export function warmProductTabRoute(href: string): void {
  const path = normalizeTabPath(href)
  const loader = PRODUCT_TAB_WARM_IMPORTS[path]
  if (loader) void loader()
}

/** Warm home + community first; defer other tabs so they do not compete with data prefetch. */
export function warmAllProductTabRoutes(): void {
  for (const path of PRIMARY_TAB_PATHS) {
    const loader = PRODUCT_TAB_WARM_IMPORTS[path]
    if (loader) void loader()
  }
  scheduleIdle(() => {
    for (const path of DEFERRED_TAB_PATHS) {
      const loader = PRODUCT_TAB_WARM_IMPORTS[path]
      if (loader) void loader()
    }
  }, 1500)
}
