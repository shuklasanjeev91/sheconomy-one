type RefreshListener = () => void

const listeners = new Set<RefreshListener>()

export function subscribeStoryRefresh(listener: RefreshListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Notify story rings / viewers to reload (after create, pull-to-refresh). */
export function refreshStories() {
  listeners.forEach((listener) => listener())
}
