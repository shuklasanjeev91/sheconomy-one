/**
 * Google Play FGS compliance for Co-Work Present:
 *
 * Keep **only** MediaProjection so Android screen share works (user taps Present
 * → system MediaProjection consent → ongoing Present notification).
 *
 * Strip phoneCall / microphone / camera / location FGS — Play rejects those
 * when unused. Do **not** remove MediaProjectionService.
 *
 * Play Console: declare **mediaProjection** only for this AAB.
 * iOS CallKit / Broadcast Extension are unchanged.
 */
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('@expo/config-plugins')

const SERVICES_TO_REMOVE = [
  'expo.modules.location.services.LocationTaskService',
  'io.wazo.callkeep.VoiceConnectionService',
  'io.wazo.callkeep.RNCallKeepBackgroundMessagingService',
  // WorkManager can register a generic FGS without a Play-approved type.
  // Present uses MediaProjection only; strip this so Play does not expect dataSync.
  'androidx.work.impl.foreground.SystemForegroundService',
]

const PERMISSIONS_TO_REMOVE = [
  'android.permission.FOREGROUND_SERVICE_CAMERA',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  'android.permission.FOREGROUND_SERVICE_SHORT_SERVICE',
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.CALL_PHONE',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
]

const SCREEN_SHARE_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
]

function ensureToolsNamespace(doc) {
  const manifest = doc?.manifest
  if (!manifest) return
  if (!manifest.$) manifest.$ = {}
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'
  }
}

function ensureRemoveService(application, name) {
  if (!application.service) application.service = []
  application.service = application.service.filter((service) => service?.$?.['android:name'] !== name)
  application.service.push({
    $: {
      'android:name': name,
      'tools:node': 'remove',
    },
  })
}

function ensureRemovePermission(manifest, name) {
  if (!manifest['uses-permission']) manifest['uses-permission'] = []
  manifest['uses-permission'] = manifest['uses-permission'].filter(
    (entry) => entry?.$?.['android:name'] !== name,
  )
  manifest['uses-permission'].push({
    $: {
      'android:name': name,
      'tools:node': 'remove',
    },
  })
}

function ensurePermission(manifest, name) {
  if (!manifest['uses-permission']) manifest['uses-permission'] = []
  manifest['uses-permission'] = manifest['uses-permission'].filter(
    (entry) => entry?.$?.['android:name'] !== name,
  )
  manifest['uses-permission'].push({
    $: {
      'android:name': name,
    },
  })
}

/** Undo a leftover tools:node=remove for Present (e.g. from a prior FGS-free build). */
function ensureKeepMediaProjectionService(application) {
  if (!application.service) application.service = []
  application.service = application.service.filter(
    (service) => service?.$?.['android:name'] !== 'com.oney.WebRTCModule.MediaProjectionService',
  )
  // Explicit app-level declaration so Play sees one clear mediaProjection service.
  application.service.push({
    $: {
      'android:name': 'com.oney.WebRTCModule.MediaProjectionService',
      'android:exported': 'false',
      'android:foregroundServiceType': 'mediaProjection',
      'android:stopWithTask': 'true',
    },
  })
}

function withAndroidFgsCompliance(config) {
  return withAndroidManifest(config, (mod) => {
    const androidManifest = mod.modResults
    ensureToolsNamespace(androidManifest)

    const manifest = androidManifest.manifest
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest)

    for (const name of SERVICES_TO_REMOVE) {
      ensureRemoveService(application, name)
    }

    ensureKeepMediaProjectionService(application)

    for (const name of PERMISSIONS_TO_REMOVE) {
      ensureRemovePermission(manifest, name)
    }

    for (const name of SCREEN_SHARE_PERMISSIONS) {
      ensurePermission(manifest, name)
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '6.3.2',
)
