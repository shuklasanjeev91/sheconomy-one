import type { BundleInfo } from '~/lib/updates/types'

/** Web loads whatever is deployed — there is no embedded/OTA distinction. */
export function getBundleInfo(): BundleInfo {
  return {
    source: 'unknown',
    updateId: null,
    createdAt: null,
    channel: null,
    runtimeVersion: null,
  }
}
