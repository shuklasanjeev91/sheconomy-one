/**
 * Stand-in for `expo-web-browser`, whose native module bridge cannot load in
 * Node. Only the surface the auth helpers reach through their import chain.
 */

export function maybeCompleteAuthSession() {
  return { type: 'failed' as const, message: 'Not supported in tests' }
}

export async function openAuthSessionAsync(_url: string, _redirectUrl?: string) {
  return { type: 'dismiss' as const }
}
