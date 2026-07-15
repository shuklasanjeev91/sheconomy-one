import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyDownloadedUpdate,
  createUpdateServiceDeps,
  resetUpdateCheckLock,
  runUpdateCheck,
  shouldPromptForDownloadedUpdate,
} from '~/lib/updates/update-service'
import type { ExpoUpdatesLike, UpdateMetadata } from '~/lib/updates/types'

function mockUpdates(partial: Partial<ExpoUpdatesLike> = {}): ExpoUpdatesLike {
  return {
    isEnabled: true,
    channel: 'production',
    updateId: 'current',
    checkForUpdateAsync: vi.fn(async () => ({ isAvailable: false })),
    fetchUpdateAsync: vi.fn(async () => ({ isNew: false })),
    reloadAsync: vi.fn(async () => {}),
    ...partial,
  }
}

function memoryMetadata(initial: Partial<UpdateMetadata> = {}) {
  let state: UpdateMetadata = {
    lastAppliedUpdateId: null,
    lastCheckAt: null,
    lastAttemptAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    dismissedUpdateId: null,
    reloadGuardUpdateId: null,
    reloadGuardCount: 0,
    ...initial,
  }
  return {
    read: async () => ({ ...state }),
    write: async (patch: Partial<UpdateMetadata>) => {
      state = { ...state, ...patch }
      return { ...state }
    },
    get: () => state,
  }
}

afterEach(() => {
  resetUpdateCheckLock()
})

describe('runUpdateCheck', () => {
  it('skips in development', async () => {
    const deps = createUpdateServiceDeps({
      updates: mockUpdates(),
      isDev: true,
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'skipped',
      reason: 'development',
    })
  })

  it('returns upToDate when no update available', async () => {
    const meta = memoryMetadata()
    const deps = createUpdateServiceDeps({
      updates: mockUpdates(),
      readMetadata: meta.read,
      writeMetadata: meta.write,
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({ kind: 'upToDate' })
  })

  it('downloads when an update is available', async () => {
    const updates = mockUpdates({
      checkForUpdateAsync: vi.fn(async () => ({
        isAvailable: true,
        manifest: { id: 'update-1' },
      })),
      fetchUpdateAsync: vi.fn(async () => ({
        isNew: true,
        manifest: { id: 'update-1' },
      })),
    })
    const meta = memoryMetadata()
    const deps = createUpdateServiceDeps({
      updates,
      readMetadata: meta.read,
      writeMetadata: meta.write,
      fetchRemoteConfig: async () => ({
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.2.0',
        critical: false,
        maintenanceMode: false,
      }),
      getNativeAppVersion: () => '1.2.0',
    })

    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'downloaded',
      updateId: 'update-1',
      critical: false,
    })
    expect(updates.fetchUpdateAsync).toHaveBeenCalledOnce()
  })

  it('marks critical from remote config', async () => {
    const updates = mockUpdates({
      checkForUpdateAsync: vi.fn(async () => ({
        isAvailable: true,
        manifest: { id: 'crit-1' },
      })),
      fetchUpdateAsync: vi.fn(async () => ({
        isNew: true,
        manifest: { id: 'crit-1' },
      })),
    })
    const deps = createUpdateServiceDeps({
      updates,
      fetchRemoteConfig: async () => ({
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.2.0',
        critical: true,
        maintenanceMode: false,
      }),
      getNativeAppVersion: () => '1.2.0',
    })

    await expect(runUpdateCheck(deps)).resolves.toMatchObject({
      kind: 'downloaded',
      critical: true,
    })
  })

  it('handles failed update check without throwing', async () => {
    const updates = mockUpdates({
      checkForUpdateAsync: vi.fn(async () => {
        throw new Error('network down')
      }),
    })
    const meta = memoryMetadata()
    const deps = createUpdateServiceDeps({
      updates,
      readMetadata: meta.read,
      writeMetadata: meta.write,
    })

    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'failed',
      message: 'network down',
    })
    expect(meta.get().lastFailureMessage).toBe('network down')
  })

  it('handles failed download', async () => {
    const updates = mockUpdates({
      checkForUpdateAsync: vi.fn(async () => ({
        isAvailable: true,
        manifest: { id: 'x' },
      })),
      fetchUpdateAsync: vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    })
    const deps = createUpdateServiceDeps({ updates })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'failed',
      message: 'fetch failed',
    })
  })

  it('prevents duplicate simultaneous checks', async () => {
    let resolveCheck: ((value: { isAvailable: boolean }) => void) | null = null
    const updates = mockUpdates({
      checkForUpdateAsync: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveCheck = resolve
          }),
      ),
    })
    const deps = createUpdateServiceDeps({ updates })
    const first = runUpdateCheck(deps)
    const second = runUpdateCheck(deps)
    expect(first).toBe(second)
    await vi.waitFor(() => {
      expect(updates.checkForUpdateAsync).toHaveBeenCalledOnce()
    })
    resolveCheck?.({ isAvailable: false })
    await expect(first).resolves.toEqual({ kind: 'upToDate' })
    await expect(second).resolves.toEqual({ kind: 'upToDate' })
  })

  it('respects cooldown after a recent check', async () => {
    const now = 1_000_000
    const meta = memoryMetadata({ lastCheckAt: now - 1_000 })
    const updates = mockUpdates()
    const deps = createUpdateServiceDeps({
      updates,
      readMetadata: meta.read,
      writeMetadata: meta.write,
      now: () => now,
      checkCooldownMs: 45_000,
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'skipped',
      reason: 'cooldown',
    })
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled()
  })

  it('supports offline startup when updates are disabled', async () => {
    const deps = createUpdateServiceDeps({
      updates: mockUpdates({ isEnabled: false }),
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'skipped',
      reason: 'updates-disabled',
    })
  })

  it('returns maintenance mode from remote config', async () => {
    const deps = createUpdateServiceDeps({
      updates: mockUpdates(),
      fetchRemoteConfig: async () => ({
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.0',
        critical: false,
        maintenanceMode: true,
        maintenanceMessage: 'Down for maintenance',
      }),
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'maintenance',
      message: 'Down for maintenance',
    })
  })

  it('requires store update when native version is too old', async () => {
    const deps = createUpdateServiceDeps({
      updates: mockUpdates(),
      getNativeAppVersion: () => '1.10.0',
      fetchRemoteConfig: async () => ({
        minimumSupportedVersion: '1.20.0',
        latestVersion: '1.20.1',
        critical: false,
        maintenanceMode: false,
      }),
    })
    await expect(runUpdateCheck(deps)).resolves.toEqual({
      kind: 'storeRequired',
      minimumSupportedVersion: '1.20.0',
    })
  })
})

describe('applyDownloadedUpdate', () => {
  it('reloads when safe', async () => {
    const updates = mockUpdates()
    const meta = memoryMetadata()
    const deps = createUpdateServiceDeps({
      updates,
      readMetadata: meta.read,
      writeMetadata: meta.write,
    })
    await expect(applyDownloadedUpdate(deps, 'u1')).resolves.toBe('restarting')
    expect(updates.reloadAsync).toHaveBeenCalledOnce()
  })

  it('blocks infinite reload loops', async () => {
    const updates = mockUpdates()
    const meta = memoryMetadata({
      reloadGuardUpdateId: 'bad',
      reloadGuardCount: 2,
    })
    const deps = createUpdateServiceDeps({
      updates,
      readMetadata: meta.read,
      writeMetadata: meta.write,
      maxReloadAttempts: 2,
    })
    await expect(applyDownloadedUpdate(deps, 'bad')).resolves.toBe('failed')
    expect(updates.reloadAsync).not.toHaveBeenCalled()
  })
})

describe('shouldPromptForDownloadedUpdate', () => {
  it('always prompts for critical updates', () => {
    expect(
      shouldPromptForDownloadedUpdate(
        { kind: 'downloaded', updateId: 'a', critical: true },
        {
          ...memoryMetadata().get(),
          dismissedUpdateId: 'a',
        },
      ),
    ).toBe(true)
  })

  it('skips optional prompt when dismissed', () => {
    expect(
      shouldPromptForDownloadedUpdate(
        { kind: 'downloaded', updateId: 'a', critical: false },
        {
          ...memoryMetadata().get(),
          dismissedUpdateId: 'a',
        },
      ),
    ).toBe(false)
  })
})
