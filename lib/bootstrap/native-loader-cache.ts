type LoaderCacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
}

const cache = new Map<string, LoaderCacheEntry<unknown>>()

/** Start a loader early so route screens can paint from cache immediately. */
export function prefetchNativeLoader<T>(key: string, loader: () => Promise<T>): void {
  if (cache.has(key)) return
  const entry: LoaderCacheEntry<T> = {}
  entry.promise = loader()
    .then((data) => {
      entry.data = data
      entry.error = null
      return data
    })
    .catch((err: unknown) => {
      entry.data = undefined
      entry.error = err instanceof Error ? err.message : String(err)
      throw err
    })
  cache.set(key, entry as LoaderCacheEntry<unknown>)
}

export function readNativeLoaderCache<T>(key: string): LoaderCacheEntry<T> | undefined {
  return cache.get(key) as LoaderCacheEntry<T> | undefined
}

export function clearNativeLoaderCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}
