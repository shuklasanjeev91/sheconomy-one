/**
 * Google Play FGS compliance (narrow strip):
 *
 * Keep MediaProjection FGS — required for Co-Work Present on Android
 * (user taps Present → system capture prompt → ongoing share notification).
 *
 * Strip unused FGS types Play rejected for this listing:
 * phoneCall / microphone / camera / location / CallKeep ConnectionService.
 *
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
]

const PERMISSIONS_TO_REMOVE = [
  'android.permission.FOREGROUND_SERVICE_CAMERA',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.CALL_PHONE',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
  // KEEP FOREGROUND_SERVICE + FOREGROUND_SERVICE_MEDIA_PROJECTION
]

const SCREEN_SHARE_SERVICE_META = 'io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE'
const MEDIA_PROJECTION_SERVICE = 'com.oney.WebRTCModule.MediaProjectionService'

function ensureToolsNamespace(doc) {
  // modResults is { manifest: { $: attrs, ... } }. Putting `$` on the document
  // itself serializes as invalid `<root xmlns:tools>` and breaks EAS
  // "Configure expo-updates".
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
  // Drop any prior positive declarations so only the remove marker remains.
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

function ensureMediaProjectionService(application) {
  if (!application.service) application.service = []
  // Drop remove markers + prior declarations so we pin a single positive entry.
  application.service = application.service.filter(
    (service) => service?.$?.['android:name'] !== MEDIA_PROJECTION_SERVICE,
  )
  application.service.push({
    $: {
      'android:name': MEDIA_PROJECTION_SERVICE,
      'android:exported': 'false',
      'android:foregroundServiceType': 'mediaProjection',
    },
  })
}

function ensurePermissionPresent(manifest, name) {
  if (!manifest['uses-permission']) manifest['uses-permission'] = []
  const existing = manifest['uses-permission'].filter((entry) => entry?.$?.['android:name'] === name)
  const hasPositive = existing.some((entry) => entry?.$?.['tools:node'] !== 'remove')
  // Drop remove markers for this permission.
  manifest['uses-permission'] = manifest['uses-permission'].filter((entry) => {
    if (entry?.$?.['android:name'] !== name) return true
    return entry?.$?.['tools:node'] !== 'remove'
  })
  if (!hasPositive) {
    manifest['uses-permission'].push({
      $: { 'android:name': name },
    })
  }
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

    for (const name of PERMISSIONS_TO_REMOVE) {
      ensureRemovePermission(manifest, name)
    }

    // Force LiveKit MediaProjection foreground service ON for Android Present.
    // LiveKit / expo-livekit-screen-share plugins also set this; pin true last.
    if (!application['meta-data']) application['meta-data'] = []
    application['meta-data'] = application['meta-data'].filter(
      (item) => item?.$?.['android:name'] !== SCREEN_SHARE_SERVICE_META,
    )
    application['meta-data'].push({
      $: {
        'android:name': SCREEN_SHARE_SERVICE_META,
        'android:value': 'true',
      },
    })

    ensurePermissionPresent(manifest, 'android.permission.FOREGROUND_SERVICE')
    ensurePermissionPresent(manifest, 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION')
    ensureMediaProjectionService(application)

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '5.1.0',
)
