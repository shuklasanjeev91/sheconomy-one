/**
 * Google Play FGS compliance:
 *
 * Strip every foreground-service type from the Android AAB. Play rejected
 * phoneCall / microphone / mediaProjection for this marketplace listing
 * (undeclared or unused FGS, not user-initiated / not perceptible).
 *
 * Co-Work Present stays on iOS (Broadcast Extension) and web. Android
 * meetings still work for camera, mic, and viewing someone else's share.
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
  'com.oney.WebRTCModule.MediaProjectionService',
]

const PERMISSIONS_TO_REMOVE = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CAMERA',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.CALL_PHONE',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
]

const SCREEN_SHARE_SERVICE_META = 'io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE'

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

    if (!application['meta-data']) application['meta-data'] = []
    application['meta-data'] = application['meta-data'].filter(
      (item) => item?.$?.['android:name'] !== SCREEN_SHARE_SERVICE_META,
    )
    application['meta-data'].push({
      $: {
        'android:name': SCREEN_SHARE_SERVICE_META,
        'android:value': 'false',
      },
    })

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '4.0.0',
)
