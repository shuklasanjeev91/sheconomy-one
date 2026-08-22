const REVISIT_FRESH_MS = 60_000

type RevisitEntry<T> = {
  value: T
  at: number
}

const memory = new Map<string, RevisitEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export function invalidateRevisit(key: string): void {
  memory.delete(key)
}

/** Module-level TTL cache for community revisit strips — avoids refetch on tab remount. */
export async function getOrFetchRevisit<T>(
  key: string,
  loader: () => Promise<T>,
  freshMs = REVISIT_FRESH_MS,
): Promise<T> {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < freshMs) {
    return hit.value as T
  }

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const task = loader()
    .then((value) => {
      memory.set(key, { value, at: Date.now() })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, task)
  return task
}

export { REVISIT_FRESH_MS }
