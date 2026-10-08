export const UPDATE_METADATA_STORAGE_KEY = '@sheconomy/ota-update-metadata/v1'

/** Last good remote update policy, so the store gate also applies offline. */
export const REMOTE_CONFIG_CACHE_KEY = '@sheconomy/remote-update-config/v1'

/** Store version the user last tapped "Later" on, and when. */
export const STORE_UPDATE_DISMISSAL_KEY = '@sheconomy/store-update-dismissal/v1'

/** Re-show the optional "new version available" prompt after this long. */
export const STORE_UPDATE_REMIND_AFTER_MS = 24 * 60 * 60 * 1000

/** Retry opening the mandatory native update flow while an install stays blocked. */
export const FORCE_UPDATE_AUTO_RETRY_MS = 5 * 60 * 1000

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
