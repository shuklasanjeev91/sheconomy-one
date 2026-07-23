import { useEffect, useState } from 'react'

/** Returns a debounced copy of `value` after `delayMs` of stability. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [delayMs, value])

  return debounced
}
