/** Shared online check used by ConnectivityProvider and unit tests. */
export function resolveOnline(state: {
  isConnected?: boolean | null
  isInternetReachable?: boolean | null
}): boolean {
  if (state.isConnected === false) return false
  if (state.isInternetReachable === false) return false
  return true
}
