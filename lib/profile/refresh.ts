import { refreshSessionProfile } from '~/lib/profile/profile-store'

type RefreshListener = () => void

const listeners = new Set<RefreshListener>()

export function subscribeProfileRefresh(listener: RefreshListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Re-read the signed-in member's profile row after a write.
 *
 * This is one shared refetch for the whole app — every `useProfile()` consumer
 * reads the same store, so they can never end up disagreeing about access.
 */
export function refreshProfiles() {
  refreshSessionProfile()
  listeners.forEach((listener) => listener())
}
