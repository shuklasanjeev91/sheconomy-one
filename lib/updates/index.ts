export {
  DEFAULT_REMOTE_UPDATE_CONFIG,
  MAX_UPDATE_RELOAD_ATTEMPTS,
  UPDATE_CHECK_COOLDOWN_MS,
  UPDATE_METADATA_STORAGE_KEY,
} from '~/lib/updates/constants'
export { logUpdate } from '~/lib/updates/logging'
export {
  EMPTY_UPDATE_METADATA,
  readUpdateMetadata,
  writeUpdateMetadata,
} from '~/lib/updates/metadata'
export {
  getAppDisplayName,
  getAppVersionLabel,
  getNativeAppVersion,
  getNativeBuildNumber,
} from '~/lib/updates/native-app-version'
export {
  fetchRemoteUpdateConfig,
  getAndroidPlayStoreUrl,
  getAppEnv,
  getIosStoreUrl,
  getUpdateConfigUrl,
} from '~/lib/updates/remote-config'
export type {
  ExpoUpdatesLike,
  RemoteUpdateConfig,
  UpdateCheckResult,
  UpdateMetadata,
  UpdatePromptKind,
  UpdateServiceDeps,
  UpdateStatus,
} from '~/lib/updates/types'
export {
  applyDownloadedUpdate,
  createUpdateServiceDeps,
  dismissOptionalUpdate,
  markUpdateApplied,
  resetUpdateCheckLock,
  runUpdateCheck,
  shouldPromptForDownloadedUpdate,
} from '~/lib/updates/update-service'
export { compareVersions, isVersionLessThan, parseVersion } from '~/lib/updates/version'
