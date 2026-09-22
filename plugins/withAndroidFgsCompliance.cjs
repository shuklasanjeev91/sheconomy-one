/**
 * Google Play FGS compliance:
 *
 * Keep **only** MediaProjection so Android Present (user-tapped screen share)
 * works. Strip phoneCall / microphone / camera / location FGS — Play rejected
 * those as unused for this marketplace listing.
 *
 * Play Console: declare **mediaProjection** for this AAB (user starts Present
 * → system capture prompt → ongoing share notification). Do not declare
 * phoneCall or microphone.
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
]

const SCREEN_SHARE_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
]

const SCREEN_SHARE_SERVICE_META = 'io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE'

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

    for (const name of SCREEN_SHARE_PERMISSIONS) {
      ensurePermission(manifest, name)
    }

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

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '6.1.0',
)
