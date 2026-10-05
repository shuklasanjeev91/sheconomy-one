import * as Updates from 'expo-updates'

import {
  MAX_UPDATE_RELOAD_ATTEMPTS,
  UPDATE_CHECK_COOLDOWN_MS,
} from '~/lib/updates/constants'
import { logUpdate } from '~/lib/updates/logging'
import { readUpdateMetadata, writeUpdateMetadata } from '~/lib/updates/metadata'
import { refreshRemoteConfig } from '~/lib/updates/store-gate'
import type { ExpoUpdatesLike, UpdateServiceDeps } from '~/lib/updates/types'

function createExpoUpdatesAdapter(): ExpoUpdatesLike {
  return {
    isEnabled: Updates.isEnabled,
    channel: Updates.channel ?? null,
    updateId: Updates.updateId ?? null,
    checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
    fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
    reloadAsync: () => Updates.reloadAsync(),
  }
}

export function createNativeUpdateServiceDeps(): UpdateServiceDeps {
  const isDev =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')

  return {
    updates: createExpoUpdatesAdapter(),
    isDev,
    fetchRemoteConfig: () => refreshRemoteConfig(),
    readMetadata: readUpdateMetadata,
    writeMetadata: writeUpdateMetadata,
    now: () => Date.now(),
    log: logUpdate,
    checkCooldownMs: UPDATE_CHECK_COOLDOWN_MS,
    maxReloadAttempts: MAX_UPDATE_RELOAD_ATTEMPTS,
  }
}
