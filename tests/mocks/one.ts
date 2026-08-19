/**
 * Stand-in for the `one` router package, which ships untranspiled sources that
 * Vitest cannot parse. Only the runtime surface the pure helpers reach through
 * their import chain is needed here.
 */

export type Href = string

export const router = {
  push: (_href: Href) => {},
  replace: (_href: Href) => {},
  back: () => {},
  navigate: (_href: Href) => {},
}

export function useRouter() {
  return router
}

export function usePathname(): string {
  return '/'
}

export function useLocalSearchParams<T extends Record<string, unknown>>(): T {
  return {} as T
}

export function useGlobalSearchParams<T extends Record<string, unknown>>(): T {
  return {} as T
}
