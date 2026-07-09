type RefreshListener = () => void

const listeners = new Set<RefreshListener>()

export function subscribeProfileRefresh(listener: RefreshListener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function refreshProfiles() {
  listeners.forEach((listener) => listener())
}
