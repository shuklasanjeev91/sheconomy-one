export const UPDATE_METADATA_STORAGE_KEY = '@sheconomy/ota-update-metadata/v1'

/** Minimum time between automatic update checks (startup / resume). */
export const UPDATE_CHECK_COOLDOWN_MS = 60_000

/** Soft cap to avoid reload loops if an update crashes on boot. */
export const MAX_UPDATE_RELOAD_ATTEMPTS = 2

/** Delay first JS OTA check so home can paint before network contention. */
export const UPDATE_CHECK_STARTUP_DELAY_MS = 4_000

export const DEFAULT_REMOTE_UPDATE_CONFIG = {
  minimumSupportedVersion: '0.0.0',
  latestVersion: '0.0.0',
  critical: false,
  maintenanceMode: false,
} as const
