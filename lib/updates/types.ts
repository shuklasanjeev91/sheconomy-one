export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'restarting'
  | 'upToDate'
  | 'failed'

export type UpdatePromptKind = 'none' | 'optional' | 'critical' | 'store' | 'maintenance'

export interface RemoteUpdateConfig {
  minimumSupportedVersion: string
  latestVersion: string
  critical: boolean
  maintenanceMode: boolean
  maintenanceMessage?: string
}

export type UpdateMetadata = {
  lastAppliedUpdateId: string | null
  lastCheckAt: number | null
  lastAttemptAt: number | null
  lastFailureAt: number | null
  lastFailureMessage: string | null
  dismissedUpdateId: string | null
  reloadGuardUpdateId: string | null
  reloadGuardCount: number
}

/** Which JS bundle is actually running — the store binary's or an OTA. */
export type BundleInfo = {
  source: 'embedded' | 'ota' | 'unknown'
  updateId: string | null
  createdAt: Date | null
  channel: string | null
  runtimeVersion: string | null
}

export type UpdateCheckResult =
  | { kind: 'skipped'; reason: string }
  | { kind: 'upToDate' }
  | { kind: 'available'; updateId: string | null; critical: boolean }
  | { kind: 'downloaded'; updateId: string | null; critical: boolean }
  | { kind: 'failed'; message: string }
  | { kind: 'maintenance'; message: string }
  | { kind: 'storeRequired'; minimumSupportedVersion: string }

export type ExpoUpdatesLike = {
  isEnabled: boolean
  channel: string | null
  updateId: string | null
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; manifest?: { id?: string } | null }>
  fetchUpdateAsync: () => Promise<{ isNew: boolean; manifest?: { id?: string } | null }>
  reloadAsync: () => Promise<void>
}

export type UpdateServiceDeps = {
  updates: ExpoUpdatesLike
  isDev: boolean
  getNativeAppVersion: () => string
  fetchRemoteConfig: () => Promise<RemoteUpdateConfig | null>
  readMetadata: () => Promise<UpdateMetadata>
  writeMetadata: (patch: Partial<UpdateMetadata>) => Promise<UpdateMetadata>
  now: () => number
  log: (level: 'info' | 'warn' | 'error', message: string, extra?: unknown) => void
  checkCooldownMs: number
  maxReloadAttempts: number
}
