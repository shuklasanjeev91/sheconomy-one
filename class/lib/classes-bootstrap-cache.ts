import type { ClassesBootstrapData } from '~/class/lib/classes-loader'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { peekAppCache, readAppCache, writeAppCache } from '~/lib/cache/app-cache'
import { isFeedFresh } from '~/lib/cache/feed-freshness'

const META_FRESH_MS = 60_000

type PaginatedSnapshot<T> = {
  items: T[]
  page: number
  hasMore: boolean
}

export function classesBootstrapKey(mediaType: 'video' | 'audio'): string {
  return mediaType === 'audio' ? CACHE_KEYS.classesAudio : CACHE_KEYS.classesVideo
}

export function classesPaginatedKey(mediaType: 'video' | 'audio'): string {
  return `${classesBootstrapKey(mediaType)}:all:all`
}

export async function readClassesBootstrap(
  mediaType: 'video' | 'audio',
): Promise<ClassesBootstrapData | null> {
  const key = classesBootstrapKey(mediaType)
  return peekAppCache<ClassesBootstrapData>(key) ?? (await readAppCache<ClassesBootstrapData>(key))
}

export function isClassesBootstrapFresh(mediaType: 'video' | 'audio'): boolean {
  return isFeedFresh(classesBootstrapKey(mediaType), META_FRESH_MS)
}

/** Seed paginated feed cache from bootstrap so usePaginatedFeed skips network. */
export async function seedClassesPaginatedFromBootstrap(
  mediaType: 'video' | 'audio',
  bootstrap: ClassesBootstrapData,
): Promise<void> {
  const paginatedKey = classesPaginatedKey(mediaType)
  if (peekAppCache<PaginatedSnapshot<unknown>>(paginatedKey)) return
  await writeAppCache(paginatedKey, {
    items: bootstrap.programs,
    page: 0,
    hasMore: bootstrap.hasMore,
  })
}
