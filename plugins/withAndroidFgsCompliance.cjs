/**
 * Google Play FGS compliance (resubmit after policy rejection):
 *
 * SHEconomy's Android store listing is marketplace-first. VoIP ConnectionService
 * and MediaProjection screen-share FGS types were rejected ("lack of material
 * user impact" / not core). This plugin strips those services + typed FGS
 * permissions from the merged AndroidManifest so the AAB declares none.
 *
 * iOS CallKit / Broadcast Extension are unchanged.
 * Android meetings still work in-foreground via LiveKit; system call UI and
 * screen share are disabled on Android only.
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

    // Ensure LiveKit screen-share meta-data does not re-enable MediaProjection FGS.
    if (application['meta-data']) {
      for (const item of application['meta-data']) {
        if (item?.$?.['android:name'] === 'io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE') {
          item.$['android:value'] = 'false'
        }
      }
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '2.0.0',
)
