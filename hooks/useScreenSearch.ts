import { useCallback, useState } from 'react'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { SEARCH_DEBOUNCE_MS } from '~/lib/search/filter'

type UseScreenSearchOptions = {
  initial?: string
  debounceMs?: number
}

/**
 * Screen-local search state: immediate `input` for the field, `debounced` for API calls.
 */
export function useScreenSearch({
  initial = '',
  debounceMs = SEARCH_DEBOUNCE_MS,
}: UseScreenSearchOptions = {}) {
  const [input, setInput] = useState(initial)
  const debounced = useDebouncedValue(input, debounceMs)
  const clear = useCallback(() => setInput(''), [])
  const isDebouncing = input.trim() !== debounced.trim()

  return { input, setInput, debounced, clear, isDebouncing }
}
