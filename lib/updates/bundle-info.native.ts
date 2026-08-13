import * as Updates from 'expo-updates'

import type { BundleInfo } from '~/lib/updates/types'

export function getBundleInfo(): BundleInfo {
  const source: BundleInfo['source'] = Updates.isEmbeddedLaunch
    ? 'embedded'
    : Updates.updateId
      ? 'ota'
      : 'unknown'

  return {
    source,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ?? null,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
  }
}
