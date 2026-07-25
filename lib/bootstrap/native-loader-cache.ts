type LoaderCacheEntry<T> = {
  data?: T
  error?: string | null
  promise?: Promise<T>
}

const cache = new Map<string, LoaderCacheEntry<unknown>>()

function linkAliases(entry: LoaderCacheEntry<unknown>, aliases?: string[]) {
  for (const alias of aliases ?? []) {
    if (!alias) continue
    cache.set(alias, entry)
  }
}

/** Synchronously seed cache so the destination screen can paint before network returns. */
export function seedNativeLoaderCache<T>(key: string, data: T, aliases?: string[]): void {
  const existing = (cache.get(key) as LoaderCacheEntry<T> | undefined) ?? {}
  // Never clobber an in-flight or completed full fetch with a lighter seed.
  if (existing.promise || existing.data !== undefined) {
    linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
    return
  }
  existing.data = data
  existing.error = null
  cache.set(key, existing as LoaderCacheEntry<unknown>)
  linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
}

/**
 * Start a loader early so route screens can paint from cache immediately.
 * If a seed already exists, still run the network upgrade in the background.
 */
export function prefetchNativeLoader<T>(
  key: string,
  loader: () => Promise<T>,
  aliases?: string[],
): void {
  const existing = (cache.get(key) as LoaderCacheEntry<T> | undefined) ?? {}
  if (existing.promise) {
    linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
    return
  }

  existing.promise = loader()
    .then((data) => {
      existing.data = data
      existing.error = null
      linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
      return data
    })
    .catch((err: unknown) => {
      // Keep any seed data so the screen does not blank out on a soft failure.
      existing.error = err instanceof Error ? err.message : String(err)
      linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
      throw err
    })
  cache.set(key, existing as LoaderCacheEntry<unknown>)
  linkAliases(existing as LoaderCacheEntry<unknown>, aliases)
}

export function readNativeLoaderCache<T>(key: string): LoaderCacheEntry<T> | undefined {
  return cache.get(key) as LoaderCacheEntry<T> | undefined
}

export function clearNativeLoaderCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}
