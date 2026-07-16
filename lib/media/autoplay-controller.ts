/**
 * Ensures only one LinkedIn-style feed video autoplays at a time (web / iOS / Android).
 */

type Listener = (activeId: string | null) => void

let activeId: string | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener(activeId)
}

/** Claim exclusive autoplay. Returns true when this id is (or becomes) active. */
export function claimAutoplay(id: string): boolean {
  if (activeId === id) return true
  activeId = id
  emit()
  return true
}

/** Release if this id currently owns autoplay. */
export function releaseAutoplay(id: string): void {
  if (activeId !== id) return
  activeId = null
  emit()
}

export function getActiveAutoplayId(): string | null {
  return activeId
}

export function subscribeAutoplay(listener: Listener): () => void {
  listeners.add(listener)
  listener(activeId)
  return () => {
    listeners.delete(listener)
  }
}
