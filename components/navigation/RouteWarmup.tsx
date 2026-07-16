/**
 * Native no-op. SPA preload warming is web-only (see RouteWarmup.web.tsx).
 * Kept free of Vite-only dynamic `import()` so Metro can bundle Release iOS.
 */
export function RouteWarmup() {
  return null
}
