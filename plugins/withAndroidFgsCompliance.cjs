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

    // Drop any tools:node=remove markers for MediaProjection that earlier
    // plugin versions may have left behind.
    if (application.service) {
      application.service = application.service.filter((service) => {
        const name = service?.$?.['android:name']
        const remove = service?.$?.['tools:node'] === 'remove'
        if (remove && name === 'com.oney.WebRTCModule.MediaProjectionService') {
          return false
        }
        return true
      })
    }
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter((entry) => {
        const name = entry?.$?.['android:name']
        const remove = entry?.$?.['tools:node'] === 'remove'
        if (
          remove &&
          (name === 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION' ||
            name === 'android.permission.FOREGROUND_SERVICE')
        ) {
          return false
        }
        return true
      })
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '5.0.0',
)
