import {
  MAX_UPDATE_RELOAD_ATTEMPTS,
  UPDATE_CHECK_COOLDOWN_MS,
} from '~/lib/updates/constants'
import type {
  ExpoUpdatesLike,
  UpdateCheckResult,
  UpdateMetadata,
  UpdateServiceDeps,
  RemoteUpdateConfig,
} from '~/lib/updates/types'
import { isVersionLessThan } from '~/lib/updates/version'

let inFlightCheck: Promise<UpdateCheckResult> | null = null

export function createUpdateServiceDeps(partial: Partial<UpdateServiceDeps> & {
  updates: ExpoUpdatesLike
}): UpdateServiceDeps {
  return {
    isDev: false,
    getNativeAppVersion: () => '0.0.0',
    fetchRemoteConfig: async () => null,
    readMetadata: async () => ({
      lastAppliedUpdateId: null,
      lastCheckAt: null,
      lastAttemptAt: null,
      lastFailureAt: null,
      lastFailureMessage: null,
      dismissedUpdateId: null,
      reloadGuardUpdateId: null,
      reloadGuardCount: 0,
    }),
    writeMetadata: async (patch) => ({
      lastAppliedUpdateId: null,
      lastCheckAt: null,
      lastAttemptAt: null,
      lastFailureAt: null,
      lastFailureMessage: null,
      dismissedUpdateId: null,
      reloadGuardUpdateId: null,
      reloadGuardCount: 0,
      ...patch,
    }),
    now: () => Date.now(),
    log: () => {},
    checkCooldownMs: UPDATE_CHECK_COOLDOWN_MS,
    maxReloadAttempts: MAX_UPDATE_RELOAD_ATTEMPTS,
    ...partial,
  }
}

export function runUpdateCheck(
  deps: UpdateServiceDeps,
  options: { force?: boolean; skipCooldown?: boolean } = {},
): Promise<UpdateCheckResult> {
  if (inFlightCheck) {
    deps.log('info', 'Skipping duplicate update check (already in flight)')
    return inFlightCheck
  }

  // Non-async so returning `inFlightCheck` does not wrap a second Promise.
  const task = performUpdateCheck(deps, options).finally(() => {
    inFlightCheck = null
  })
  inFlightCheck = task
  return task
}

/** Test helper — clears the module-level in-flight lock. */
export function resetUpdateCheckLock(): void {
  inFlightCheck = null
}

async function performUpdateCheck(
  deps: UpdateServiceDeps,
  options: { force?: boolean; skipCooldown?: boolean },
): Promise<UpdateCheckResult> {
  if (deps.isDev) {
    return { kind: 'skipped', reason: 'development' }
  }

  const metadata = await deps.readMetadata()
  const now = deps.now()

  if (
    !options.force &&
    !options.skipCooldown &&
    metadata.lastCheckAt != null &&
    now - metadata.lastCheckAt < deps.checkCooldownMs
  ) {
    return { kind: 'skipped', reason: 'cooldown' }
  }

  await deps.writeMetadata({ lastCheckAt: now, lastAttemptAt: now })

  let remote: RemoteUpdateConfig | null = null
  try {
    remote = await deps.fetchRemoteConfig()
  } catch (error) {
    deps.log('warn', 'Remote config failed; continuing with OTA check', error)
  }

  if (remote?.maintenanceMode) {
    return {
      kind: 'maintenance',
      message:
        remote.maintenanceMessage?.trim() ||
        'We are performing scheduled maintenance. Please try again shortly.',
    }
  }

  const nativeVersion = deps.getNativeAppVersion()
  if (remote && isVersionLessThan(nativeVersion, remote.minimumSupportedVersion)) {
    return {
      kind: 'storeRequired',
      minimumSupportedVersion: remote.minimumSupportedVersion,
    }
  }

  if (!deps.updates.isEnabled) {
    return { kind: 'skipped', reason: 'updates-disabled' }
  }

  try {
    const check = await deps.updates.checkForUpdateAsync()
    if (!check.isAvailable) {
      await deps.writeMetadata({
        lastFailureAt: null,
        lastFailureMessage: null,
      })
      return { kind: 'upToDate' }
    }

    const availableId = check.manifest?.id ?? null
    const critical = Boolean(remote?.critical)

    deps.log('info', 'Update available; downloading', { availableId, critical })

    const fetched = await deps.updates.fetchUpdateAsync()
    const downloadedId = fetched.manifest?.id ?? availableId

    if (
      downloadedId &&
      metadata.reloadGuardUpdateId === downloadedId &&
      metadata.reloadGuardCount >= deps.maxReloadAttempts
    ) {
      deps.log('error', 'Reload guard blocked applying update', { downloadedId })
      await deps.writeMetadata({
        lastFailureAt: now,
        lastFailureMessage: 'Reload guard: too many restart attempts for this update',
      })
      return {
        kind: 'failed',
        message: 'Update could not be applied safely. Using the previous version.',
      }
    }

    await deps.writeMetadata({
      lastFailureAt: null,
      lastFailureMessage: null,
    })

    return {
      kind: 'downloaded',
      updateId: downloadedId,
      critical,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update check failed'
    deps.log('error', 'Update check/download failed', error)
    await deps.writeMetadata({
      lastFailureAt: now,
      lastFailureMessage: message,
    })
    return { kind: 'failed', message }
  }
}

export async function applyDownloadedUpdate(
  deps: UpdateServiceDeps,
  updateId: string | null,
): Promise<'restarting' | 'failed'> {
  if (deps.isDev) return 'failed'
  if (!deps.updates.isEnabled) return 'failed'

  const metadata = await deps.readMetadata()
  const reloadGuardCount =
    metadata.reloadGuardUpdateId === updateId ? metadata.reloadGuardCount + 1 : 1

  await deps.writeMetadata({
    reloadGuardUpdateId: updateId,
    reloadGuardCount,
    lastAttemptAt: deps.now(),
  })

  if (reloadGuardCount > deps.maxReloadAttempts) {
    deps.log('error', 'Blocked reload to prevent infinite loop', { updateId })
    return 'failed'
  }

  try {
    await deps.updates.reloadAsync()
    return 'restarting'
  } catch (error) {
    deps.log('error', 'reloadAsync failed', error)
    await deps.writeMetadata({
      lastFailureAt: deps.now(),
      lastFailureMessage: error instanceof Error ? error.message : 'reload failed',
    })
    return 'failed'
  }
}

export async function markUpdateApplied(
  deps: UpdateServiceDeps,
  updateId: string | null,
): Promise<UpdateMetadata> {
  return deps.writeMetadata({
    lastAppliedUpdateId: updateId,
    reloadGuardUpdateId: null,
    reloadGuardCount: 0,
    dismissedUpdateId: null,
  })
}

export async function dismissOptionalUpdate(
  deps: UpdateServiceDeps,
  updateId: string | null,
): Promise<UpdateMetadata> {
  return deps.writeMetadata({
    dismissedUpdateId: updateId,
  })
}

export function shouldPromptForDownloadedUpdate(
  result: Extract<UpdateCheckResult, { kind: 'downloaded' }>,
  metadata: UpdateMetadata,
): boolean {
  if (result.critical) return true
  if (!result.updateId) return true
  return metadata.dismissedUpdateId !== result.updateId
}
