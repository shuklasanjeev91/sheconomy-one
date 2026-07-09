import { useLocalSearchParams } from 'one'

import { getSearchParam } from '~/lib/platform/url'

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key]
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && value[0]) return value[0]
  return getSearchParam(key)
}

/** Cross-platform query param reader (route params on native, URL on web fallback). */
export function useQueryParam(key: string): string | null {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>()
  return readParam(params, key)
}

export function useQueryParams(): Record<string, string | string[] | undefined> {
  return useLocalSearchParams<Record<string, string | string[] | undefined>>()
}
