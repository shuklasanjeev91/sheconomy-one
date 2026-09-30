/** Shared online check used by ConnectivityProvider and unit tests. */
export function resolveOnline(state: {
  isConnected?: boolean | null
  isInternetReachable?: boolean | null
}): boolean {
  // Explicit link-down always means offline.
  if (state.isConnected === false) return false

  // NetInfo on web / localhost / some captive portals reports
  // `isInternetReachable: false` even while the link is up and WebRTC works.
  // Trust a positive `isConnected` over a negative reachability probe.
  if (state.isConnected === true) return true

  // Unknown link — fall back to reachability when it is explicitly false.
  if (state.isInternetReachable === false) return false
  return true
}
